import os

from flask import Flask, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_jwt_extended import (
    JWTManager, create_access_token,
    jwt_required, get_jwt_identity
)
from dotenv import load_dotenv
from flask_cors import CORS
import bcrypt
import csv
import io
from psycopg2.extras import execute_values
from cache import CategoryCache
from database import get_connection, release_connection
from categoriseAPI2 import run_cache_tiers, run_llm_tier, combined_status
from checkingName import NEEDS_MANUAL_REVIEW
from categoriseAugDB import load_categories, patch_merchants_category_rename


load_dotenv()

app = Flask(__name__)
CORS(app)

app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = False

jwt = JWTManager(app)

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["20 per day", "50 per hour"],
    storage_uri="memory://",
)


# --- User table helpers ---
# IMPORTANT: category_records.user_id and transactions.user_id are both
# INTEGER foreign keys to users.id - NOT the username. The JWT identity
# must therefore be the integer id, not the username string, or every
# personal-cache query will fail with "invalid input syntax for type
# integer" the moment a non-numeric username hits a WHERE user_id = %s.
@app.route('/categories', methods=['GET'])
@jwt_required()
@limiter.limit("100 per day")
def get_categories():
    """Returns every user-facing category, in display order, with its
    colour - the live replacement for the old static CATEGORY_ORDER/
    CATEGORY_COLORS import from checkingName.js. The MANUALLY CATEGORISE
    sentinel is deliberately not included here, same reasoning as
    load_categories() itself - it's a system state, not a real category.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT name, color, default_color FROM categories ORDER BY display_order"
            )
            rows = cur.fetchall()

        categories = [{'name': row[0], 'color': row[1], 'defaultColor': row[2]} for row in rows]
        return jsonify({'categories': categories}), 200
    except Exception as e:
        app.logger.error(f'Fetching categories failed: {e}')
        return jsonify({'error': 'Failed to fetch categories'}), 500
    finally:
        release_connection(conn)

@app.route('/categories', methods=['PATCH'])
@jwt_required()
@limiter.limit("20 per day")
def update_category():
    """Renames a category and/or changes its colour.

    The category being changed (current_name) travels in the JSON body
    now, not the URL path - some category names contain a literal "/"
    (e.g. "Sports/Fitness"), and a URL-encoded slash (%2F) is handled
    specially by a lot of web infrastructure for security reasons
    (ambiguous-path attacks), which meant it could get rejected or
    mismatched before Flask's own routing ever got a chance to look at
    it - regardless of using <path:...> in the route. Request bodies
    have no such restriction on any character, so this sidesteps the
    problem entirely rather than continuing to fight framework/web
    server internals we don't have full visibility into.

    Renaming cascades everywhere the OLD name currently appears -
    category_records (both scopes), merchants, and every stored
    transaction - since this is safe regardless of any description's
    ambiguity status: it relabels a category string that already
    exists, it does not assert anything new about what a description
    means (unlike the resolved-vs-ambiguous backfill in /categorize/
    resolve, which genuinely does need that check).

    Recolouring only ever touches the categories table itself - colour
    is looked up by name at render time, never stored per-transaction,
    so there is nothing to cascade.
    """
    data = request.get_json() or {}
    category_name = data.get('current_name')
    new_name = data.get('new_name')
    new_color = data.get('color')

    if not category_name:
        return jsonify({'error': 'current_name is required'}), 400
    if not new_name and not new_color:
        return jsonify({'error': 'Provide new_name and/or color'}), 400

    current_user = int(get_jwt_identity())
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # Only the admin account may rename or recolour categories -
            # this is global, shared structure affecting every user, not
            # a personal action any signed-up account should be able to
            # trigger.
            cur.execute("SELECT username FROM users WHERE id = %s", (current_user,))
            row = cur.fetchone()
            if not row or row[0] != "admin":
                return jsonify({'error': 'Not authorized'}), 403
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM categories WHERE name = %s", (category_name,))
            if not cur.fetchone():
                return jsonify({'error': f'Category "{category_name}" not found'}), 404

            original_category_name = category_name
            renamed = bool(new_name and new_name != category_name)

            if renamed:
                cur.execute("SELECT 1 FROM categories WHERE name = %s", (new_name,))
                if cur.fetchone():
                    return jsonify({'error': f'Category "{new_name}" already exists'}), 409

                cur.execute("UPDATE categories SET name = %s WHERE name = %s", (new_name, category_name))
                cur.execute("UPDATE category_records SET category = %s WHERE category = %s", (new_name, category_name))
                cur.execute("UPDATE merchants SET category = %s WHERE category = %s", (new_name, category_name))
                cur.execute("UPDATE transactions SET category = %s WHERE category = %s", (new_name, category_name))
                category_name = new_name

            if new_color:
                cur.execute("UPDATE categories SET color = %s WHERE name = %s", (new_color, category_name))

        conn.commit()

        if renamed:
            # The UPDATEs above change category_records/merchants
            # directly in Postgres, bypassing CategoryCache entirely -
            # the process-level global caches (cache.py, categoriseAugDB.py)
            # have no way to know this happened on their own, and would
            # otherwise keep serving the OLD category name from memory
            # for the rest of this process's lifetime. Patch both caches
            # in place with the same rename, cheaply, instead of
            # discarding them and paying for a full reload on the next
            # request.
            CategoryCache.patch_global_category_rename(original_category_name, new_name)
            patch_merchants_category_rename(original_category_name, new_name)

        return jsonify({'status': 'ok', 'name': category_name, 'color': new_color}), 200
    except Exception as e:
        conn.rollback()
        app.logger.error(f'Category update failed: {e}')
        return jsonify({'error': 'Category update failed - please try again'}), 500
    finally:
        release_connection(conn)

@app.route('/categories/reset-defaults', methods=['POST'])
@jwt_required()
@limiter.limit("20 per day")
def reset_category_defaults():
    """Resets color back to default_color, scoped to whichever category
    names are given - same scoping convention as update_category's
    recolour action (applies to a selected set, not the whole table
    unconditionally), so this button lives inside the same
    select-some-categories flow the picker already uses.

    Admin-only, same reasoning as recolouring itself: this is global,
    shared structure, not a personal action.
    """
    data = request.get_json() or {}
    names = data.get('names')

    if not names or not isinstance(names, list):
        return jsonify({'error': 'names must be a non-empty list'}), 400

    current_user = int(get_jwt_identity())
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT username FROM users WHERE id = %s", (current_user,))
            row = cur.fetchone()
            if not row or row[0] != "admin":
                return jsonify({'error': 'Not authorized'}), 403

        with conn.cursor() as cur:
            cur.execute(
                "UPDATE categories SET color = default_color WHERE name = ANY(%s)",
                (names,),
            )

        conn.commit()

        with conn.cursor() as cur:
            cur.execute("SELECT name, color, default_color FROM categories ORDER BY display_order")
            rows = cur.fetchall()
        categories = [{'name': row[0], 'color': row[1], 'defaultColor': row[2]} for row in rows]
        return jsonify({'categories': categories}), 200
    except Exception as e:
        conn.rollback()
        app.logger.error(f'Reset category defaults failed: {e}')
        return jsonify({'error': 'Reset failed - please try again'}), 500
    finally:
        release_connection(conn)


@app.route('/categories/default-color', methods=['PATCH'])
@jwt_required()
@limiter.limit("20 per day")
def update_default_color():
    """Admin-only: redefines what a category's DEFAULT colour is - i.e.
    what "reset to defaults" resets TO - as distinct from update_category,
    which changes the CURRENT live colour. current_name travels in the
    body, same convention as update_category, for the same reason (some
    category names contain characters that don't play well as URL path
    segments).
    """
    data = request.get_json() or {}
    category_name = data.get('current_name')
    new_default_color = data.get('default_color')

    if not category_name or not new_default_color:
        return jsonify({'error': 'current_name and default_color are required'}), 400

    current_user = int(get_jwt_identity())
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT username FROM users WHERE id = %s", (current_user,))
            row = cur.fetchone()
            if not row or row[0] != "admin":
                return jsonify({'error': 'Not authorized'}), 403

        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM categories WHERE name = %s", (category_name,))
            if not cur.fetchone():
                return jsonify({'error': f'Category "{category_name}" not found'}), 404

            cur.execute(
                "UPDATE categories SET default_color = %s WHERE name = %s",
                (new_default_color, category_name),
            )

        conn.commit()
        return jsonify({'status': 'ok', 'name': category_name, 'default_color': new_default_color}), 200
    except Exception as e:
        conn.rollback()
        app.logger.error(f'Default colour update failed: {e}')
        return jsonify({'error': 'Default colour update failed - please try again'}), 500
    finally:
        release_connection(conn)


def get_user_by_username(conn, username):
    """Returns (id, password_hash) for a username, or None if not found."""
    with conn.cursor() as cur:
        cur.execute("SELECT id, password_hash FROM users WHERE username = %s", (username,))
        row = cur.fetchone()
        return row if row else None


def username_exists(conn, username):
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM users WHERE username = %s", (username,))
        return cur.fetchone() is not None


def create_user(conn, username, password_hash):
    """Inserts a new user and returns the new integer id."""
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO users (username, password_hash) VALUES (%s, %s) RETURNING id",
            (username, password_hash),
        )
        new_id = cur.fetchone()[0]
    conn.commit()
    return new_id
TRANSIENT_CATEGORY_VALUES = {'PENDING_LLM', 'FAILED - rerun'}

def update_transaction_categories(conn, user_id, result):
    """Writes each transaction's resolved category back into the
    transactions table, by its real database id. Skips items with no id
    (shouldn't happen for anything that went through parse_csv) and
    items still sitting at a transient/placeholder category - those
    aren't a final answer yet, so the stored row is left as NULL until
    a later tier or manual resolution actually settles it.
    """
    with conn.cursor() as cur:
        for item in result:
            txn_id = item.get('id')
            category = item.get('category')
            if txn_id is None or category in TRANSIENT_CATEGORY_VALUES:
                continue
            cur.execute(
                "UPDATE transactions SET category = %s WHERE id = %s AND user_id = %s",
                (category, txn_id, user_id),
            )


@app.route('/auth/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    data = request.get_json()

    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'username and password required'}), 400

    username = data['username']
    password = data['password']

    conn = get_connection()
    try:
        row = get_user_by_username(conn, username)

        if not row:
            # Dummy check to prevent timing attacks revealing whether
            # the username exists
            bcrypt.checkpw(b'dummy', bcrypt.hashpw(b'dummy', bcrypt.gensalt()))
            return jsonify({'error': 'Invalid credentials'}), 401

        user_id, stored_hash = row

        if not bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8')):
            return jsonify({'error': 'Invalid credentials'}), 401

        # Identity is the integer user id (as a string, since JWT subjects
        # must be strings) - NOT the username. Every downstream DB query
        # keyed on user_id depends on this being the real foreign key value.
        token = create_access_token(identity=str(user_id))
        return jsonify({'access_token': token}), 200
    finally:
        release_connection(conn)


@app.route('/auth/signup', methods=['POST'])
@limiter.limit("5 per minute")
def signup():
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'username and password required'}), 400

    username = data['username'].strip()
    password = data['password']

    if not username:
        return jsonify({'error': 'Username cannot be empty'}), 400
    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400
    if len(username) > 30:
        return jsonify({'error': 'Username must be under 30 characters'}), 400
    if not username.replace('_', '').replace('-', '').isalnum():
        return jsonify({'error': 'Username can only contain letters, numbers, hyphens and underscores'}), 400

    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    conn = get_connection()
    try:
        if username_exists(conn, username):
            return jsonify({'error': 'Username already taken'}), 409

        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12))
        new_id = create_user(conn, username, hashed.decode('utf-8'))

        token = create_access_token(identity=str(new_id))
        return jsonify({'access_token': token}), 201
    except Exception as e:
        conn.rollback()
        app.logger.error(f'Signup failed: {e}')
        return jsonify({'error': 'Signup failed - please try again'}), 500
    finally:
        release_connection(conn)


MAX_CSV_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB - a bank export has no
# business being bigger than this; a basic safety cap against
# accidental or malicious oversized uploads.

CSV_FORMULA_TRIGGER_CHARS = ('=', '+', '-', '@', '\t', '\r')


def _sanitize_cell(value):
    """Strip a leading formula-injection trigger character from a cell
    before it's stored/displayed. A description or date field starting
    with '=', '+', '-', or '@' can be interpreted as a formula by
    spreadsheet software (Excel, Sheets) if this data is ever exported
    or opened there - legitimate bank transaction text never starts
    with these, so stripping is safe. Only applied to the values we
    store/display, never to the dedup key, so matching against
    previously-stored transactions is unaffected.
    """
    v = value
    while v and v[0] in CSV_FORMULA_TRIGGER_CHARS:
        v = v[1:].strip()
    return v


@app.route('/api/parse-csv', methods=['POST'])
@jwt_required()
@limiter.limit("50 per day")
def parse_csv():
    current_user = int(get_jwt_identity())

    if 'files' not in request.files:
        return jsonify({"error": "No files provided"}), 400

    uploaded_files = request.files.getlist('files')
    parsed_rows = []
    seen_lines = set()
    # Which dedup_keys each filename first introduced within this
    # request. Used after the DB insert to work out which files (if
    # any) actually contributed brand-new data, vs. ones that turned
    # out to be pure re-uploads/subsets of what's already stored.
    file_dedup_keys = {}

    for file in uploaded_files:
        if not file.filename.lower().endswith('.csv'):
            continue

        raw_bytes = file.stream.read()

        if len(raw_bytes) > MAX_CSV_FILE_SIZE_BYTES:
            app.logger.warning(f"User {current_user} uploaded oversized file: {file.filename} ({len(raw_bytes)} bytes)")
            continue

        try:
            file_stream = io.StringIO(raw_bytes.decode("utf-8"), newline=None)
        except UnicodeDecodeError:
            app.logger.warning(f"User {current_user} uploaded non-UTF-8 file: {file.filename}")
            continue

        reader = csv.reader(file_stream)
        this_file_keys = []

        for row in reader:
            if not row or len(row) < 3:
                continue

            raw_date = row[0].strip()
            raw_description = row[1].strip()
            raw_amount = row[2].strip()

            if not raw_date or not raw_description:
                continue

            try:
                amount = float(
                    raw_amount
                    .replace(',', '')
                    .replace('£', '')
                    .replace('$', '')
                    .replace('"', '')
                )
            except ValueError:
                # Basic safety check: a row whose amount can't be
                # parsed at all is malformed, not a legitimate
                # zero-value transaction - skip it rather than
                # silently fabricating a 0.0 amount.
                continue

            # Same construction as before (raw stripped columns 0-2),
            # kept byte-identical so it still matches dedup_keys
            # already stored in the DB from before this change.
            normalized_line = f"{raw_date}|{raw_description}|{raw_amount}"

            if normalized_line not in seen_lines:
                seen_lines.add(normalized_line)
                this_file_keys.append(normalized_line)

                parsed_rows.append({
                    "date": _sanitize_cell(raw_date),
                    "description": _sanitize_cell(raw_description),
                    "amount": amount,
                    "dedup_key": normalized_line,
                })

        # Basic CSV check: a file that yielded no usable rows at all
        # (wrong format, empty, header-only, garbage) was never really
        # "processed" - it shouldn't be recorded as an accepted upload.
        if not this_file_keys:
            app.logger.warning(f"User {current_user} uploaded file with no valid rows: {file.filename}")
            continue

        file_dedup_keys[file.filename] = this_file_keys

    all_parsed_rows = []
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            resolved_by_dedup_key = {}
            newly_inserted_keys = set()

            if parsed_rows:
                inserted = execute_values(
                    cur,
                    """INSERT INTO transactions (user_id, txn_date, description, amount, category, dedup_key)
                       VALUES %s
                       ON CONFLICT (user_id, dedup_key) DO NOTHING
                       RETURNING id, category, dedup_key""",
                    [
                        (current_user, r["date"], r["description"], r["amount"], None, r["dedup_key"])
                        for r in parsed_rows
                    ],
                    template="(%s, %s, %s, %s, %s, %s)",
                    fetch=True,
                )
                for txn_id, category, dedup_key in inserted:
                    resolved_by_dedup_key[dedup_key] = (txn_id, category)
                    newly_inserted_keys.add(dedup_key)

                missing_dedup_keys = [
                    r["dedup_key"] for r in parsed_rows
                    if r["dedup_key"] not in resolved_by_dedup_key
                ]
                if missing_dedup_keys:
                    cur.execute(
                        """SELECT id, category, dedup_key FROM transactions
                           WHERE user_id = %s AND dedup_key = ANY(%s)""",
                        (current_user, missing_dedup_keys),
                    )
                    for txn_id, category, dedup_key in cur.fetchall():
                        resolved_by_dedup_key[dedup_key] = (txn_id, category)

                for r in parsed_rows:
                    transaction_id, existing_category = resolved_by_dedup_key[r["dedup_key"]]
                    all_parsed_rows.append({
                        "id": transaction_id,
                        "date": r["date"],
                        "description": r["description"],
                        "amount": r["amount"],
                        "category": existing_category,
                    })

            # A file only counts toward the upload total if it actually
            # contributed at least one dedup_key that was genuinely new
            # to the DB (i.e. survived ON CONFLICT DO NOTHING above).
            # An exact re-upload of a file already on record - or a
            # multi-month file where every row turns out to already
            # exist - contributes nothing new, so it doesn't increment.
            # This runs in the SAME transaction as the transaction
            # insert, so if the request rolls back, the count doesn't
            # move either.
            files_with_new_data = [
                filename for filename, keys in file_dedup_keys.items()
                if any(k in newly_inserted_keys for k in keys)
            ]

            if files_with_new_data:
                execute_values(
                    cur,
                    "INSERT INTO uploaded_files (user_id, filename) VALUES %s",
                    [(current_user, filename) for filename in files_with_new_data],
                    template="(%s, %s)",
                )

        conn.commit()
    except Exception as e:
        conn.rollback()
        app.logger.error(f'Storing parsed transactions failed for user {current_user}: {e}')
        return jsonify({'error': 'Failed to store parsed transactions - please try again'}), 500
    finally:
        release_connection(conn)

    app.logger.info(f"User {current_user} parsed {len(all_parsed_rows)} transactions from {len(uploaded_files)} file(s)")
    return jsonify({"transactions": all_parsed_rows})


@app.route('/transactions', methods=['GET'])
@jwt_required()
@limiter.limit("100 per day")
def get_transactions():
    """Returns every transaction ever stored for the logged-in user, so
    the app can restore history on open instead of starting empty every
    session. Ordered by id (insertion order) rather than date, since
    txn_date is stored as free-form text (whatever format the bank
    export used) and doesn't sort chronologically as a string - the
    frontend already re-sorts by parsed date for display anyway.
    """
    current_user = int(get_jwt_identity())

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, txn_date, description, amount, category
                   FROM transactions
                   WHERE user_id = %s
                   ORDER BY id""",
                (current_user,),
            )
            rows = cur.fetchall()

        transactions = [
            {
                'id': row[0],
                'date': row[1],
                'description': row[2],
                'amount': float(row[3]),
                'category': row[4],
            }
            for row in rows
        ]
        return jsonify({'transactions': transactions}), 200
    except Exception as e:
        app.logger.error(f'Fetching transaction history failed for user {current_user}: {e}')
        return jsonify({'error': 'Failed to fetch transaction history'}), 500
    finally:
        release_connection(conn)


@app.route('/categorize/cached', methods=['POST'])
@jwt_required()
@limiter.limit("100 per day")
def categorize_cached():
    current_user = int(get_jwt_identity())
    data = request.get_json()

    if not data or 'transactions' not in data:
        return jsonify({'error': 'Request must contain "transactions"'}), 400

    transactions = data['transactions']
    if not isinstance(transactions, list) or not transactions:
        return jsonify({'error': 'transactions must be a non-empty list'}), 400

    conn = get_connection()
    try:
        result = run_cache_tiers(transactions, current_user, conn)
        update_transaction_categories(conn, current_user, result)
        conn.commit()
        return jsonify({'transactions': result}), 200
    except Exception as e:
        conn.rollback()
        app.logger.error(f'Cache tier failed for user {current_user}: {e}')
        return jsonify({'error': 'Cache lookup failed - please try again'}), 500
    finally:
        release_connection(conn)


@app.route('/categorize/llm', methods=['POST'])
@jwt_required()
@limiter.limit("20 per day")
def categorize_llm():
    current_user = int(get_jwt_identity())
    data = request.get_json()

    if not data or 'transactions' not in data:
        return jsonify({'error': 'Request must contain "transactions"'}), 400

    transactions = data['transactions']
    if not isinstance(transactions, list) or not transactions:
        return jsonify({'error': 'transactions must be a non-empty list'}), 400

    # Optional client-controlled Gemini batch size (unique descriptions
    # per LLM call inside run_llm_tier). Falls back to that function's
    # own default (200) if not provided. Bounded to keep someone from
    # sending something pathological (0, negative, or huge enough to
    # risk truncated Gemini responses).
    batch_size_kwargs = {}
    if 'batch_size' in data:
        try:
            batch_size = int(data['batch_size'])
        except (TypeError, ValueError):
            return jsonify({'error': 'batch_size must be an integer'}), 400
        if not (1 <= batch_size <= 2000):
            return jsonify({'error': 'batch_size must be between 1 and 2000'}), 400
        batch_size_kwargs['batch_size'] = batch_size

    # Optional client-controlled per-call Gemini timeout in milliseconds
    # (see GEMINI_REQUEST_TIMEOUT_MS in useFileProcessor.js - that's the
    # actual number to change, this just carries it through). Falls
    # back to categoriseAugDB.py's DEFAULT_GEMINI_REQUEST_TIMEOUT_MS if
    # not provided. Bounded well under the gunicorn worker timeout so a
    # client can't accidentally (or deliberately) request a timeout long
    # enough to recreate the exact SIGKILL scenario this exists to
    # prevent.
    gemini_timeout_kwargs = {}
    if 'gemini_timeout_ms' in data:
        try:
            gemini_timeout_ms = int(data['gemini_timeout_ms'])
        except (TypeError, ValueError):
            return jsonify({'error': 'gemini_timeout_ms must be an integer'}), 400
        if not (1000 <= gemini_timeout_ms <= 90000):
            return jsonify({'error': 'gemini_timeout_ms must be between 1000 and 90000'}), 400
        gemini_timeout_kwargs['gemini_timeout_ms'] = gemini_timeout_ms

    conn = get_connection()
    try:
        result = run_llm_tier(transactions, current_user, conn, **batch_size_kwargs, **gemini_timeout_kwargs)
        update_transaction_categories(conn, current_user, result)
        conn.commit()
        return jsonify({'transactions': result}), 200
    except Exception as e:
        conn.rollback()
        app.logger.error(f'LLM tier failed for user {current_user}: {e}')
        return jsonify({'error': 'LLM categorisation failed - please try again'}), 500
    finally:
        release_connection(conn)


@app.route('/categorize/resolve', methods=['POST'])
@jwt_required()
@limiter.limit("100 per day")
def resolve_manual():
    current_user = int(get_jwt_identity())
    data = request.get_json()

    if not data or 'resolutions' not in data:
        return jsonify({'error': 'Request must contain "resolutions"'}), 400

    resolutions = data['resolutions']
    if not isinstance(resolutions, list) or not resolutions:
        return jsonify({'error': 'resolutions must be a non-empty list'}), 400


    conn = get_connection()
    try:
        valid_categories = set(load_categories(conn))
        personal_cache = CategoryCache(conn, scope='personal', user_id=current_user)
        global_cache = CategoryCache(conn, scope='global')
        personal_cache.preload()
        global_cache.preload()

        updated = []
        skipped = []

        for r in resolutions:
            desc = r.get('description')
            date = r.get('date')
            amount = r.get('amount')
            category = r.get('category')

            if not all([desc, date, category]) or amount is None:
                skipped.append(r)
                continue
            if category not in valid_categories or category == NEEDS_MANUAL_REVIEW:
                skipped.append(r)
                continue

            amount_str = str(amount)

            resolved = personal_cache.resolve_record(desc, date, amount_str, category)

            if not resolved:
                removed_from_personal = personal_cache.remove_record(desc, date, amount_str, category=None)
                if not removed_from_personal:
                    global_cache.remove_record(desc, date, amount_str, category=None)
                personal_cache.add_record(desc, date, amount_str, category)

            with conn.cursor() as cur:
                cur.execute(
                    """UPDATE transactions SET category = %s
                       WHERE user_id = %s AND description = %s
                         AND txn_date = %s AND amount = %s""",
                    (category, current_user, desc, date, amount),
                )

            status_after = combined_status(desc, personal_cache, global_cache)
            if status_after['status'] == 'resolved':
                with conn.cursor() as cur:
                    cur.execute(
                        """UPDATE transactions SET category = %s
                           WHERE user_id = %s AND description = %s""",
                        (category, current_user, desc),
                    )

            updated.append({'description': desc, 'date': date, 'amount': amount, 'category': category})

        if personal_cache.dirty:
            personal_cache.save()
        if global_cache.dirty:
            global_cache.save()

        conn.commit()
        return jsonify({'updated': updated, 'skipped': skipped}), 200
    except Exception as e:
        conn.rollback()
        app.logger.error(f'Resolve failed for user {current_user}: {e}')
        return jsonify({'error': 'Resolve failed - please try again'}), 500
    finally:
        release_connection(conn)


@app.route('/charts/summary', methods=['GET'])
@jwt_required()
@limiter.limit("100 per day")
def charts_summary():
    """Pre-aggregated spending totals for the Charts screen - one row
    per (year, category) and, separately, one row per (year, month,
    category). Sums are computed INSIDE Postgres via GROUP BY/SUM - the
    response size is bounded by (years x months x categories), not by
    how many actual transactions produced those totals.
    """
    current_user = int(get_jwt_identity())
    excluded_categories = list(TRANSIENT_CATEGORY_VALUES | {NEEDS_MANUAL_REVIEW})

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                r"""SELECT SUBSTRING(txn_date FROM 7 FOR 4)::INTEGER AS year,
                           category,
                           SUM(ABS(amount)) AS total
                    FROM transactions
                    WHERE user_id = %s
                      AND category IS NOT NULL
                      AND NOT (category = ANY(%s))
                      AND txn_date ~ '^\d{2}/\d{2}/\d{4}$'
                    GROUP BY year, category
                    ORDER BY year""",
                (current_user, excluded_categories),
            )
            yearly = [
                {'year': row[0], 'category': row[1], 'total': float(row[2])}
                for row in cur.fetchall()
            ]

            cur.execute(
                r"""SELECT SUBSTRING(txn_date FROM 7 FOR 4)::INTEGER AS year,
                           SUBSTRING(txn_date FROM 4 FOR 2)::INTEGER AS month,
                           category,
                           SUM(ABS(amount)) AS total
                    FROM transactions
                    WHERE user_id = %s
                      AND category IS NOT NULL
                      AND NOT (category = ANY(%s))
                      AND txn_date ~ '^\d{2}/\d{2}/\d{4}$'
                    GROUP BY year, month, category
                    ORDER BY year, month""",
                (current_user, excluded_categories),
            )
            monthly = [
                {'year': row[0], 'month': row[1], 'category': row[2], 'total': float(row[3])}
                for row in cur.fetchall()
            ]

        return jsonify({'yearly': yearly, 'monthly': monthly}), 200
    except Exception as e:
        app.logger.error(f'Fetching chart summary failed for user {current_user}: {e}')
        return jsonify({'error': 'Failed to fetch chart summary'}), 500
    finally:
        release_connection(conn)


@app.route('/uploads/count', methods=['GET'])
@jwt_required()
@limiter.limit("100 per day")
def get_upload_count():
    """Total number of accepted CSV files this user has ever uploaded -
    powers the "you've uploaded N files" summary on the home screen.
    Counts upload EVENTS (re-uploading the same file adds to this),
    not distinct filenames.
    """
    current_user = int(get_jwt_identity())
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM uploaded_files WHERE user_id = %s", (current_user,))
            count = cur.fetchone()[0]
        return jsonify({'count': count}), 200
    except Exception as e:
        app.logger.error(f'Fetching upload count failed for user {current_user}: {e}')
        return jsonify({'error': 'Failed to fetch upload count'}), 500
    finally:
        release_connection(conn)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200


if __name__ == '__main__':
    debug = os.environ.get('FLASK_ENV') == 'development'
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=debug,
    )