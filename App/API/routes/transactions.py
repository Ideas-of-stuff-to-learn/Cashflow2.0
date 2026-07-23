"""
routes/transactions.py

CSV upload/parsing, listing/deleting transactions, upload count, and
the categorization pipeline endpoints (/categorize/cached,
/categorize/llm, /categorize/resolve). The cache-tier logic itself
lives in categoriseAPI2.py / categoriseAugDB.py - this file is just the
HTTP layer over it.
"""
import csv
import io
from time import perf_counter

from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from psycopg2.extras import execute_values

from extensions import app, limiter
from database import get_connection, release_connection
from cache import CategoryCache
from categorise.pipeline import run_cache_tiers
from categorise.llm_tier import run_llm_tier
from categorise.exact_tier import combined_status, run_exact_tier
from categorise.merchant_tier import run_merchant_tier
from categorise.similarity_tier import run_similarity_tier

from matching import load_categories
from checkingName import NEEDS_MANUAL_REVIEW
from shared import TRANSIENT_CATEGORY_VALUES, update_transaction_categories


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
    """Returns transactions for the logged-in user. Supports optional
    pagination via ?offset=N&limit=N query params - if neither is given,
    returns all rows (the old behaviour, kept for CLI callers and any
    other client that fetches in one shot). When limit is given, also
    returns a `total` count in the response so the client knows when it
    has fetched everything without needing a separate request.

    Ordered by id (insertion order) rather than date, since txn_date is
    stored as free-form text and doesn't sort chronologically as a string
    - the frontend re-sorts by parsed date for display anyway.
    """
    current_user = int(get_jwt_identity())

    raw_offset = request.args.get('offset')
    raw_limit = request.args.get('limit')
    paginated = raw_limit is not None

    try:
        offset = max(0, int(raw_offset)) if raw_offset is not None else 0
        limit = min(max(1, int(raw_limit)), 2000) if raw_limit is not None else None
    except (TypeError, ValueError):
        return jsonify({'error': 'offset and limit must be integers'}), 400

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            if paginated:
                cur.execute(
                    "SELECT COUNT(*) FROM transactions WHERE user_id = %s",
                    (current_user,),
                )
                total = cur.fetchone()[0]
                cur.execute(
                    """SELECT id, txn_date, description, amount, category
                       FROM transactions
                       WHERE user_id = %s
                       ORDER BY id
                       LIMIT %s OFFSET %s""",
                    (current_user, limit, offset),
                )
            else:
                total = None
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

        response = {'transactions': transactions}
        if paginated:
            response['total'] = total
            response['offset'] = offset
            response['limit'] = limit
        return jsonify(response), 200
    except Exception as e:
        app.logger.error(f'Fetching transaction history failed for user {current_user}: {e}')
        return jsonify({'error': 'Failed to fetch transaction history'}), 500
    finally:
        release_connection(conn)


@app.route('/transactions', methods=['DELETE'])
@jwt_required()
@limiter.limit("100 per day")
def delete_transactions():
    """Deletes one or more of the CURRENT USER's own transactions by id.

    Not admin-only, unlike the category endpoints - this is a personal
    action on your own data, not global shared structure. Scoped by
    `user_id = current_user` in the WHERE clause (not just `id = ANY`)
    so there's no way to delete another user's rows even by guessing
    ids - any id that doesn't belong to you is silently ignored rather
    than erroring, same as it just wouldn't exist from your perspective.

    Returns how many rows actually got deleted, which can legitimately
    be less than len(ids) if the caller's local state was stale (e.g.
    something already deleted in another session) - not treated as an
    error, same reasoning as skipped rows in /categorize/resolve.
    """
    data = request.get_json() or {}
    ids = data.get('ids')

    if not ids or not isinstance(ids, list):
        return jsonify({'error': 'ids must be a non-empty list'}), 400
    try:
        ids = [int(i) for i in ids]
    except (TypeError, ValueError):
        return jsonify({'error': 'ids must be a list of integers'}), 400

    current_user = int(get_jwt_identity())
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM transactions WHERE user_id = %s AND id = ANY(%s)",
                (current_user, ids),
            )
            deleted_count = cur.rowcount
        conn.commit()
        return jsonify({'status': 'ok', 'deleted': deleted_count}), 200
    except Exception as e:
        conn.rollback()
        app.logger.error(f'Deleting transactions failed for user {current_user}: {e}')
        return jsonify({'error': 'Delete failed - please try again'}), 500
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


# The three endpoints below are the phase-split replacement for
# /categorize/cached above (kept as-is for any caller still using it in
# one shot). Each is its own HTTP round trip so the frontend can apply
# a phase's results - and let the user SEE them - as soon as they land,
# instead of waiting for exact + merchant + similarity to all finish
# before anything updates. See useFileProcessor.js for the calling
# sequence: exact -> (whatever's still PENDING_LLM) -> merchant ->
# (whatever's still PENDING_LLM) -> similarity -> (whatever's still
# PENDING_LLM) -> /categorize/llm.
@app.route('/categorize/cached/exact', methods=['POST'])
@jwt_required()
@limiter.limit("100 per day")
def categorize_cached_exact():
    current_user = int(get_jwt_identity())
    data = request.get_json()

    if not data or 'transactions' not in data:
        return jsonify({'error': 'Request must contain "transactions"'}), 400

    transactions = data['transactions']
    if not isinstance(transactions, list) or not transactions:
        return jsonify({'error': 'transactions must be a non-empty list'}), 400

    conn = get_connection()
    try:
        backend_started_at = perf_counter()

        exact_started_at = perf_counter()
        result = run_exact_tier(transactions, current_user, conn)
        exact_ms = (perf_counter() - exact_started_at) * 1000

        update_transaction_categories(conn, current_user, result)
        conn.commit()

        total_backend_ms = (perf_counter() - backend_started_at) * 1000

        return jsonify({
            'transactions': result,
            'timings': {
                'exact_ms': exact_ms,
                'total_backend_ms': total_backend_ms,
            },
        }), 200

    except Exception as e:
        conn.rollback()
        app.logger.error(
            f'Exact cache tier failed for user {current_user}: {e}'
        )
        return jsonify({
            'error': 'Cache lookup failed - please try again'
        }), 500

    finally:
        release_connection(conn)

@app.route('/categorize/cached/merchant', methods=['POST'])
@jwt_required()
@limiter.limit("100 per day")
def categorize_cached_merchant():
    current_user = int(get_jwt_identity())
    data = request.get_json()

    if not data or 'transactions' not in data:
        return jsonify({'error': 'Request must contain "transactions"'}), 400

    transactions = data['transactions']
    if not isinstance(transactions, list) or not transactions:
        return jsonify({'error': 'transactions must be a non-empty list'}), 400

    conn = get_connection()
    try:
        backend_started_at = perf_counter()

        merchant_started_at = perf_counter()
        result = run_merchant_tier(transactions, conn)
        merchant_ms = (perf_counter() - merchant_started_at) * 1000

        update_transaction_categories(conn, current_user, result)
        conn.commit()

        total_backend_ms = (perf_counter() - backend_started_at) * 1000

        return jsonify({
            'transactions': result,
            'timings': {
                'merchant_ms': merchant_ms,
                'total_backend_ms': total_backend_ms,
            },
        }), 200

    except Exception as e:
        conn.rollback()
        app.logger.error(
            f'Merchant tier failed for user {current_user}: {e}'
        )
        return jsonify({
            'error': 'Merchant lookup failed - please try again'
        }), 500

    finally:
        release_connection(conn)


@app.route('/categorize/cached/similarity', methods=['POST'])
@jwt_required()
@limiter.limit("100 per day")
def categorize_cached_similarity():
    current_user = int(get_jwt_identity())
    data = request.get_json()

    if not data or 'transactions' not in data:
        return jsonify({'error': 'Request must contain "transactions"'}), 400

    transactions = data['transactions']
    if not isinstance(transactions, list) or not transactions:
        return jsonify({'error': 'transactions must be a non-empty list'}), 400

    conn = get_connection()
    try:
        backend_started_at = perf_counter()

        similarity_started_at = perf_counter()
        result = run_similarity_tier(transactions, conn)
        similarity_ms = (perf_counter() - similarity_started_at) * 1000

        update_transaction_categories(conn, current_user, result)
        conn.commit()

        total_backend_ms = (perf_counter() - backend_started_at) * 1000

        return jsonify({
            'transactions': result,
            'timings': {
                'similarity_ms': similarity_ms,
                'total_backend_ms': total_backend_ms,
            },
        }), 200

    except Exception as e:
        conn.rollback()
        app.logger.error(
            f'Similarity tier failed for user {current_user}: {e}'
        )
        return jsonify({
            'error': 'Similarity lookup failed - please try again'
        }), 500

    finally:
        release_connection(conn)

@app.route('/categorize/llm', methods=['POST'])
@jwt_required()
@limiter.limit("20 per day")
def categorize_llm():
    current_user = int(get_jwt_identity())
    data = request.get_json()

    if not data or 'transactions' not in data:
        return jsonify({
            'error': 'Request must contain "transactions"'
        }), 400

    transactions = data['transactions']

    if not isinstance(transactions, list) or not transactions:
        return jsonify({
            'error': 'transactions must be a non-empty list'
        }), 400

    # Optional client-controlled Gemini batch size.
    batch_size_kwargs = {}

    if 'batch_size' in data:
        try:
            batch_size = int(data['batch_size'])
        except (TypeError, ValueError):
            return jsonify({
                'error': 'batch_size must be an integer'
            }), 400

        if not (1 <= batch_size <= 2000):
            return jsonify({
                'error': 'batch_size must be between 1 and 2000'
            }), 400

        batch_size_kwargs['batch_size'] = batch_size

    # Optional client-controlled Gemini request timeout.
    gemini_timeout_kwargs = {}

    if 'gemini_timeout_ms' in data:
        try:
            gemini_timeout_ms = int(data['gemini_timeout_ms'])
        except (TypeError, ValueError):
            return jsonify({
                'error': 'gemini_timeout_ms must be an integer'
            }), 400

        if not (1000 <= gemini_timeout_ms <= 90000):
            return jsonify({
                'error': 'gemini_timeout_ms must be between 1000 and 90000'
            }), 400

        gemini_timeout_kwargs['gemini_timeout_ms'] = gemini_timeout_ms

    conn = get_connection()

    try:
        backend_started_at = perf_counter()

        llm_result = run_llm_tier(
            transactions,
            current_user,
            conn,
            **batch_size_kwargs,
            **gemini_timeout_kwargs
        )

        result = llm_result['transactions']
        timings = llm_result['timings']

        update_transaction_categories(
            conn,
            current_user,
            result
        )

        conn.commit()

        timings['total_backend_ms'] = (
            perf_counter() - backend_started_at
        ) * 1000

        return jsonify({
            'transactions': result,
            'timings': timings,
        }), 200

    except Exception as e:
        conn.rollback()

        app.logger.error(
            f'LLM tier failed for user {current_user}: {e}'
        )

        return jsonify({
            'error': 'LLM categorisation failed - please try again'
        }), 500

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


