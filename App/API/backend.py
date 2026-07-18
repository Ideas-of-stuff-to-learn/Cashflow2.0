import os
import re
from datetime import timedelta

from flask import Flask, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_jwt_extended import (
    JWTManager, create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, get_jwt, decode_token
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
from permissions import (
    require_permission, get_user_role_and_permissions,
    list_all_permissions, list_all_roles, list_all_users,
    get_role_by_name, create_role, update_role, delete_role,
    assign_user_role, set_user_permission_override,
    get_user_level, delete_user, update_user_credentials,
)


load_dotenv()

app = Flask(__name__)
CORS(app)

app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY')

# Replaces the old JWT_ACCESS_TOKEN_EXPIRES = False (tokens that never
# expired at all, no matter which of login/signup/impersonate issued
# them - see handoff5.txt for why that was a real problem, not a
# theoretical one). Access tokens are now short-lived; refresh tokens
# (created_refresh_token(), used by /auth/refresh below) are the
# longer-lived thing that lets the app/CLI silently obtain a new access
# token without asking for a password again, right up until the
# refresh token itself expires or is revoked.
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)

# Deliberately much shorter than a normal access token, and passed
# explicitly as expires_delta on the ONE call site that uses it
# (admin_impersonate_user, below) rather than being a global default -
# an impersonation session is a bounded admin task, not something that
# should be able to linger for a full day like an ordinary login.
IMPERSONATION_TOKEN_EXPIRES = timedelta(minutes=15)

jwt = JWTManager(app)


@jwt.token_in_blocklist_loader
def check_if_token_revoked(jwt_header, jwt_payload):
    """Runs automatically on EVERY @jwt_required()-protected request,
    right after signature verification succeeds - this is what makes
    revocation (POST /auth/logout, POST /admin/tokens/revoke) actually
    mean something, as opposed to inserting rows into a table nothing
    ever reads. A signature-valid-but-revoked token is rejected here
    with the same effect as an expired one."""
    jti = jwt_payload["jti"]
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM revoked_tokens WHERE jti = %s", (jti,))
            return cur.fetchone() is not None
    finally:
        release_connection(conn)

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
        # Renaming and recolouring are two distinct permission keys
        # (categories.rename / categories.recolor) - a request touching
        # BOTH in one call needs both, since granting one shouldn't
        # silently imply the other. This replaces what used to be a
        # single hardcoded username=='admin' check covering everything.
        with conn.cursor() as cur:
            _role, _level, perms = get_user_role_and_permissions(conn, current_user)
        is_owner = _role == 'owner'
        if new_name and not (is_owner or 'categories.rename' in perms):
            return jsonify({'error': 'Not authorized'}), 403
        if new_color and not (is_owner or 'categories.recolor' in perms):
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

@app.route('/categories/combine', methods=['PATCH'])
@jwt_required()
@require_permission('categories.combine')
@limiter.limit("20 per day")
def combine_categories():
    """Merges 2+ existing categories into one, under new_name.

    new_name can be a brand new name, or it can match one of the
    categories already being merged (e.g. combining "Travel" and
    "Trips" into "Travel" - keeping that name rather than picking
    something new). It canNOT match some OTHER, unrelated category
    that isn't part of this merge - that would silently fold this
    merge's data into an unrelated category no one asked to touch.

    Implementation-wise this reuses one EXISTING row from `names`
    (whichever one ends up being new_name, or the first one given if
    new_name is genuinely new - renamed in place) rather than
    inserting a fresh categories row, so there's no need to invent a
    display_order or colour for a brand new row: the survivor just
    keeps whatever it already had. Every other selected category's
    data is folded into that survivor, then its own categories row is
    deleted.

    Same cascade as a rename (category_records, merchants,
    transactions), just done once per category being folded in rather
    than once overall. Admin-only, same reasoning as rename/recolour -
    this is global, shared structure.
    """
    data = request.get_json() or {}
    names = data.get('names')
    new_name = (data.get('new_name') or '').strip()

    if not names or not isinstance(names, list) or len(names) < 2:
        return jsonify({'error': 'names must be a list of at least 2 categories'}), 400
    if len(set(names)) != len(names):
        return jsonify({'error': 'names contains duplicates'}), 400
    if not new_name:
        return jsonify({'error': 'new_name is required'}), 400

    current_user = int(get_jwt_identity())
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT name FROM categories WHERE name = ANY(%s)", (names,))
            found = {r[0] for r in cur.fetchall()}
            missing = [n for n in names if n not in found]
            if missing:
                return jsonify({'error': f'Categor{"y" if len(missing) == 1 else "ies"} not found: {", ".join(missing)}'}), 404

            # new_name is only a conflict if it belongs to some category
            # OUTSIDE this merge - matching one of the categories already
            # being merged is fine (that's the "keep this existing name"
            # case), that's just not treated as a NEW conflicting row.
            cur.execute("SELECT 1 FROM categories WHERE name = %s", (new_name,))
            new_name_exists_elsewhere = bool(cur.fetchone()) and new_name not in names
            if new_name_exists_elsewhere:
                return jsonify({'error': f'Category "{new_name}" already exists and is not part of this merge'}), 409

            # Pick which existing row survives:
            # - if new_name matches one of the selected categories,
            #   THAT row survives unchanged (no rename needed) - the
            #   "keep this existing name" case.
            # - otherwise new_name is genuinely new, so the FIRST
            #   selected category's row survives, renamed to new_name.
            new_name_is_new = new_name not in names
            base_name = names[0] if new_name_is_new else new_name
            others = [n for n in names if n != base_name]

            if new_name_is_new:
                cur.execute("UPDATE categories SET name = %s WHERE name = %s", (new_name, base_name))
                # base_name's own data still says the OLD name string
                # everywhere else (categories.name isn't a foreign key
                # anywhere) - cascade it the same as a plain rename.
                cur.execute("UPDATE category_records SET category = %s WHERE category = %s", (new_name, base_name))
                cur.execute("UPDATE merchants SET category = %s WHERE category = %s", (new_name, base_name))
                cur.execute("UPDATE transactions SET category = %s WHERE category = %s", (new_name, base_name))

            for old_name in others:
                cur.execute("UPDATE category_records SET category = %s WHERE category = %s", (new_name, old_name))
                cur.execute("UPDATE merchants SET category = %s WHERE category = %s", (new_name, old_name))
                cur.execute("UPDATE transactions SET category = %s WHERE category = %s", (new_name, old_name))
                cur.execute("DELETE FROM categories WHERE name = %s", (old_name,))

        conn.commit()

        # Same in-memory cache patching as a plain rename, just once
        # per folded-in name instead of once overall.
        renamed_away = [n for n in names if n != new_name]
        for old_name in renamed_away:
            CategoryCache.patch_global_category_rename(old_name, new_name)
            patch_merchants_category_rename(old_name, new_name)

        return jsonify({'status': 'ok', 'name': new_name, 'merged_from': renamed_away}), 200
    except Exception as e:
        conn.rollback()
        app.logger.error(f'Category combine failed: {e}')
        return jsonify({'error': 'Category combine failed - please try again'}), 500
    finally:
        release_connection(conn)

@app.route('/categories', methods=['DELETE'])
@jwt_required()
@require_permission('categories.delete')
@limiter.limit("20 per day")
def delete_category():
    """Deletes a category entirely - admin-only, same reasoning as the
    other category endpoints.

    Anything currently in this category (category_records, merchants,
    transactions) gets reassigned to NEEDS_MANUAL_REVIEW rather than
    left pointing at a category string that no longer exists anywhere -
    an orphaned reference like that can't self-heal the way a rename
    desync can (there's no "fetch the current name" to resync to, the
    category is just gone), so it would sit permanently broken instead.
    NEEDS_MANUAL_REVIEW is the existing "needs a human to decide" state
    already used when the LLM itself can't confidently categorise
    something - conceptually the same situation here.

    If you want a category's data to end up in some OTHER real
    category rather than manual review, use /categories/combine
    instead - this endpoint is specifically for abandoning a category
    altogether.
    """
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()

    if not name:
        return jsonify({'error': 'name is required'}), 400

    current_user = int(get_jwt_identity())
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM categories WHERE name = %s", (name,))
            if not cur.fetchone():
                return jsonify({'error': f'Category "{name}" not found'}), 404

            cur.execute("UPDATE category_records SET category = %s WHERE category = %s", (NEEDS_MANUAL_REVIEW, name))
            cur.execute("UPDATE merchants SET category = %s WHERE category = %s", (NEEDS_MANUAL_REVIEW, name))
            cur.execute("UPDATE transactions SET category = %s WHERE category = %s", (NEEDS_MANUAL_REVIEW, name))
            reassigned_count = cur.rowcount
            cur.execute("DELETE FROM categories WHERE name = %s", (name,))

        conn.commit()

        # Same in-memory cache patching as rename/combine.
        CategoryCache.patch_global_category_rename(name, NEEDS_MANUAL_REVIEW)
        patch_merchants_category_rename(name, NEEDS_MANUAL_REVIEW)

        return jsonify({'status': 'ok', 'deleted': name, 'reassigned_transactions': reassigned_count}), 200
    except Exception as e:
        conn.rollback()
        app.logger.error(f'Category deletion failed: {e}')
        return jsonify({'error': 'Category deletion failed - please try again'}), 500
    finally:
        release_connection(conn)

@app.route('/categories', methods=['POST'])
@jwt_required()
@require_permission('categories.create')
@limiter.limit("20 per day")
def create_category():
    """Adds a brand new category - admin-only, same reasoning as
    rename/combine/recolour: this is global, shared structure.

    Unlike rename/combine, this needs no cascade anywhere: nothing
    references this name yet by definition, so there's nothing else
    to update. load_categories() (categoriseAugDB.py) re-queries the
    categories table fresh on every /categorize/llm call with no
    caching of its own, so a newly added category is available to the
    LLM as a valid target immediately, on the very next categorisation
    request - no cache to invalidate, no restart needed.

    display_order is auto-assigned as one past the current max, so new
    categories always land at the end of the list rather than needing
    the caller to know/guess a free slot. color is required; default_color
    is seeded identical to it, same convention as the schema's initial
    seed data - "reset to default" will revert to whatever color was
    given here until changed via the separate default-color admin tool.
    """
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    color = (data.get('color') or '').strip()

    if not name:
        return jsonify({'error': 'name is required'}), 400
    if not color:
        return jsonify({'error': 'color is required'}), 400
    if not re.match(r'^#[0-9A-Fa-f]{6}$', color):
        return jsonify({'error': 'color must be a hex string like #3D8B5F'}), 400
    if name == NEEDS_MANUAL_REVIEW:
        return jsonify({'error': f'"{name}" is a reserved system value, not a real category'}), 400

    current_user = int(get_jwt_identity())
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM categories WHERE name = %s", (name,))
            if cur.fetchone():
                return jsonify({'error': f'Category "{name}" already exists'}), 409

            cur.execute("SELECT COALESCE(MAX(display_order), 0) FROM categories")
            next_order = cur.fetchone()[0] + 1

            cur.execute(
                "INSERT INTO categories (name, display_order, color, default_color) VALUES (%s, %s, %s, %s)",
                (name, next_order, color, color),
            )

        conn.commit()
        return jsonify({'status': 'ok', 'name': name, 'color': color, 'display_order': next_order}), 201
    except Exception as e:
        conn.rollback()
        app.logger.error(f'Category creation failed: {e}')
        return jsonify({'error': 'Category creation failed - please try again'}), 500
    finally:
        release_connection(conn)


@app.route('/categories/order', methods=['PATCH'])
@jwt_required()
@require_permission('categories.reorder')
@limiter.limit("20 per day")
def reorder_categories():
    """Sets the global display_order for all categories. `names` must be
    a list containing every existing category name exactly once - no
    extras, no omissions. The position in the list becomes the new
    display_order (index 0 = order 1, the bottom segment of the stack).
    Affects every user immediately since GET /categories already returns
    rows ORDER BY display_order.

    Validated strictly before any writes: the request is rejected as a
    whole if the provided list doesn't exactly match the current set of
    categories - this prevents a partial reorder leaving display_order
    values in an inconsistent or colliding state.
    """
    data = request.get_json() or {}
    names = data.get('names')
    if not names or not isinstance(names, list):
        return jsonify({'error': 'names (list of category names) is required'}), 400

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT name FROM categories ORDER BY display_order")
            existing = [row[0] for row in cur.fetchall()]

        existing_set = set(existing)
        incoming_set = set(names)

        if len(names) != len(set(names)):
            return jsonify({'error': 'names contains duplicates'}), 400
        missing = existing_set - incoming_set
        extra = incoming_set - existing_set
        if missing or extra:
            parts = []
            if missing:
                parts.append(f'missing: {", ".join(sorted(missing))}')
            if extra:
                parts.append(f'unknown: {", ".join(sorted(extra))}')
            return jsonify({'error': f'names must include every existing category exactly once — {"; ".join(parts)}'}), 400

        with conn.cursor() as cur:
            for i, name in enumerate(names, start=1):
                cur.execute(
                    "UPDATE categories SET display_order = %s WHERE name = %s",
                    (i, name),
                )
        conn.commit()

        with conn.cursor() as cur:
            cur.execute("SELECT name, color, default_color FROM categories ORDER BY display_order")
            categories = [
                {'name': row[0], 'color': row[1], 'defaultColor': row[2]}
                for row in cur.fetchall()
            ]
        return jsonify({'categories': categories}), 200
    except Exception as e:
        conn.rollback()
        app.logger.error(f'Reorder categories failed: {e}')
        return jsonify({'error': 'Reorder failed - please try again'}), 500
    finally:
        release_connection(conn)


@app.route('/categories/reset-defaults', methods=['POST'])
@jwt_required()
@require_permission('categories.recolor')
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
@require_permission('categories.set_default_color')
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
    """Inserts a new user and returns the new integer id. Assigned the
    'user' role immediately at creation time - NOT left NULL to be
    picked up by schema.sql's backfill later, since that backfill only
    runs when schema.sql is re-executed (a fresh deploy/DB recreation),
    not on every signup. A brand new signup should never have a NULL
    role_id even for the moment before some unrelated migration script
    next happens to run."""
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO users (username, password_hash, role_id)
               VALUES (%s, %s, (SELECT id FROM roles WHERE name = 'user'))
               RETURNING id""",
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


# =====================================================================
# Permission system endpoints
# =====================================================================
# /auth/me is callable by anyone logged in - it's how both the app
# (for the role badge) and the CLI (for "what am I even allowed to do")
# find out their own access, without needing a separate admin-only
# lookup just to see your own status.
#
# Everything else here is genuinely admin-tooling: managing OTHER
# people's roles/permissions, and defining what roles/permissions exist
# at all. Each one is gated by its own specific permission key, same
# pattern as the category endpoints above - there is no single
# "is_admin" shortcut anywhere in this section.
@app.route('/auth/me', methods=['GET'])
@jwt_required()
@limiter.limit("100 per day")
def auth_me():
    current_user = int(get_jwt_identity())
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT username FROM users WHERE id = %s", (current_user,))
            row = cur.fetchone()
        username = row[0] if row else None
        role_name, level, perms = get_user_role_and_permissions(conn, current_user)
        return jsonify({
            'username': username,
            'role': role_name,
            'level': level,
            'permissions': sorted(perms),
        }), 200
    except Exception as e:
        app.logger.error(f'Fetching own identity failed for user {current_user}: {e}')
        return jsonify({'error': 'Failed to fetch account info'}), 500
    finally:
        release_connection(conn)


@app.route('/admin/permissions', methods=['GET'])
@jwt_required()
@require_permission('roles.view')
@limiter.limit("100 per day")
def admin_list_permissions():
    """The master list of every permission key that exists - what
    CLI/admin-panel checklists build their options from."""
    conn = get_connection()
    try:
        return jsonify({'permissions': list_all_permissions(conn)}), 200
    except Exception as e:
        app.logger.error(f'Fetching permissions failed: {e}')
        return jsonify({'error': 'Failed to fetch permissions'}), 500
    finally:
        release_connection(conn)


@app.route('/admin/roles', methods=['GET'])
@jwt_required()
@require_permission('roles.view')
@limiter.limit("100 per day")
def admin_list_roles():
    conn = get_connection()
    try:
        return jsonify({'roles': list_all_roles(conn)}), 200
    except Exception as e:
        app.logger.error(f'Fetching roles failed: {e}')
        return jsonify({'error': 'Failed to fetch roles'}), 500
    finally:
        release_connection(conn)


@app.route('/admin/roles', methods=['POST'])
@jwt_required()
@require_permission('roles.manage')
@limiter.limit("20 per day")
def admin_create_role():
    """Creates a new custom role. The caller's own level acts as a
    ceiling: you cannot create a role at or above your own level (an
    owner has no ceiling; a level-50 admin with roles.manage could at
    most create something at level 49 or below) - otherwise a single
    permission grant (roles.manage) would let someone mint a role as
    powerful as themselves or higher, which defeats the point of levels
    existing at all."""
    data = request.get_json() or {}
    name = data.get('name')
    level = data.get('level')
    permission_keys = data.get('permissions') or []

    if level is None or not isinstance(level, int):
        return jsonify({'error': 'level (integer) is required'}), 400
    if not isinstance(permission_keys, list):
        return jsonify({'error': 'permissions must be a list of keys'}), 400

    current_user = int(get_jwt_identity())
    conn = get_connection()
    try:
        caller_role, caller_level, _perms = get_user_role_and_permissions(conn, current_user)
        if caller_role != 'owner' and level >= caller_level:
            return jsonify({'error': f'Cannot create a role at or above your own level ({caller_level})'}), 403

        role = create_role(conn, name, level, permission_keys)
        conn.commit()
        return jsonify({'role': role}), 201
    except ValueError as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        conn.rollback()
        app.logger.error(f'Role creation failed: {e}')
        return jsonify({'error': 'Role creation failed - please try again'}), 500
    finally:
        release_connection(conn)


@app.route('/admin/roles/<int:role_id>', methods=['PATCH'])
@jwt_required()
@require_permission('roles.manage')
@limiter.limit("20 per day")
def admin_update_role(role_id):
    """Edits a role's level and/or permission bundle (permissions, if
    given, REPLACES the whole set - not additive, matching this app's
    existing PATCH convention elsewhere). Same level-ceiling guard as
    creation: a non-owner can't push a role's level to or above their
    own."""
    data = request.get_json() or {}
    level = data.get('level')
    permission_keys = data.get('permissions')

    if permission_keys is not None and not isinstance(permission_keys, list):
        return jsonify({'error': 'permissions must be a list of keys'}), 400

    current_user = int(get_jwt_identity())
    conn = get_connection()
    try:
        caller_role, caller_level, _perms = get_user_role_and_permissions(conn, current_user)
        if level is not None:
            if not isinstance(level, int):
                return jsonify({'error': 'level must be an integer'}), 400
            if caller_role != 'owner' and level >= caller_level:
                return jsonify({'error': f'Cannot set a role to your level or above ({caller_level})'}), 403

        role = update_role(conn, role_id, level=level, permission_keys=permission_keys)
        conn.commit()
        return jsonify({'role': role}), 200
    except ValueError as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        conn.rollback()
        app.logger.error(f'Role update failed: {e}')
        return jsonify({'error': 'Role update failed - please try again'}), 500
    finally:
        release_connection(conn)


@app.route('/admin/roles/<int:role_id>', methods=['DELETE'])
@jwt_required()
@require_permission('roles.manage')
@limiter.limit("20 per day")
def admin_delete_role(role_id):
    conn = get_connection()
    try:
        delete_role(conn, role_id)
        conn.commit()
        return jsonify({'status': 'ok', 'deleted_role_id': role_id}), 200
    except ValueError as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        conn.rollback()
        app.logger.error(f'Role deletion failed: {e}')
        return jsonify({'error': 'Role deletion failed - please try again'}), 500
    finally:
        release_connection(conn)


@app.route('/admin/users', methods=['GET'])
@jwt_required()
@require_permission('users.view')
@limiter.limit("100 per day")
def admin_list_users():
    conn = get_connection()
    try:
        return jsonify({'users': list_all_users(conn)}), 200
    except Exception as e:
        app.logger.error(f'Fetching users failed: {e}')
        return jsonify({'error': 'Failed to fetch users'}), 500
    finally:
        release_connection(conn)


@app.route('/admin/users/<int:target_user_id>/role', methods=['PATCH'])
@jwt_required()
@require_permission('users.assign_role')
@limiter.limit("20 per day")
def admin_assign_role(target_user_id):
    """Assigns a role to another user, by role name. Same level-ceiling
    guard as role creation/editing: a non-owner with users.assign_role
    can only hand out roles strictly BELOW their own level - otherwise
    a level-50 admin with this one permission could promote someone
    (including themselves, via a different account) to their own tier
    or higher, which would make "levels" meaningless. Only the owner is
    exempt from this ceiling, including being able to assign the owner
    role itself to someone else - that's a deliberate, high-trust
    action the owner is allowed to take, not something the system
    should second-guess.
    """
    data = request.get_json() or {}
    role_name = data.get('role')
    if not role_name:
        return jsonify({'error': 'role is required'}), 400

    current_user = int(get_jwt_identity())
    conn = get_connection()
    try:
        caller_role, caller_level, _perms = get_user_role_and_permissions(conn, current_user)
        target_role = get_role_by_name(conn, role_name)
        if not target_role:
            return jsonify({'error': f'Role "{role_name}" not found'}), 404
        if caller_role != 'owner' and target_role['level'] >= caller_level:
            return jsonify({'error': f'Cannot assign a role at or above your own level ({caller_level})'}), 403

        user = assign_user_role(conn, target_user_id, role_name)
        conn.commit()
        return jsonify({'user': user}), 200
    except ValueError as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        conn.rollback()
        app.logger.error(f'Role assignment failed: {e}')
        return jsonify({'error': 'Role assignment failed - please try again'}), 500
    finally:
        release_connection(conn)


@app.route('/admin/users/<int:target_user_id>/permissions', methods=['PATCH'])
@jwt_required()
@require_permission('users.manage_permissions')
@limiter.limit("20 per day")
def admin_set_permission_override(target_user_id):
    """Grants, revokes, or clears ONE individual permission override for
    ONE user - the fine-grained, per-person exception mechanism
    (schema.sql's user_permission_overrides). `granted` is a
    three-state field: true (extra grant), false (explicit revoke even
    if the role would give it), or null/omitted (clear any existing
    override, fall back to whatever the role alone says).
    """
    data = request.get_json() or {}
    permission_key = data.get('permission')
    granted = data.get('granted', None)

    if not permission_key:
        return jsonify({'error': 'permission is required'}), 400
    if granted is not None and not isinstance(granted, bool):
        return jsonify({'error': 'granted must be true, false, or omitted/null'}), 400

    conn = get_connection()
    try:
        user = set_user_permission_override(conn, target_user_id, permission_key, granted)
        conn.commit()
        return jsonify({'user': user}), 200
    except ValueError as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        conn.rollback()
        app.logger.error(f'Permission override failed: {e}')
        return jsonify({'error': 'Permission override failed - please try again'}), 500
    finally:
        release_connection(conn)


# --- Direct account-lifecycle actions (create/edit/delete/impersonate) ---
# Distinct from the role/permission-management endpoints above - these
# act on the ACCOUNT itself (does it exist, what are its credentials,
# can you borrow its session), not on what role/permissions it has.
# Added after the initial round of this system, per explicit request;
# bundled into the 'admin' role by default (see schema.sql) rather
# than owner-only, unlike users.view/assign_role/manage_permissions
# and roles.* above.
@app.route('/admin/users', methods=['POST'])
@jwt_required()
@require_permission('users.create')
@limiter.limit("20 per day")
def admin_create_user():
    """Creates a new user account directly, as an elevated action -
    distinct from the public, self-service /auth/signup (no permission
    check at all, rate-limited separately). Assigned the plain 'user'
    role at creation, same as any ordinary signup - use the "assign a
    role" action afterward if this account should start out elevated.
    Same validation rules as /auth/signup via the shared
    validate_username()/validate_password() helpers, so the two paths
    can never quietly drift into accepting different things."""
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    error = validate_username(username) or validate_password(password)
    if error:
        return jsonify({'error': error}), 400

    conn = get_connection()
    try:
        if username_exists(conn, username):
            return jsonify({'error': 'Username already taken'}), 409

        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12))
        new_id = create_user(conn, username, hashed.decode('utf-8'))
        user = next(u for u in list_all_users(conn) if u['id'] == new_id)
        return jsonify({'user': user}), 201
    except Exception as e:
        conn.rollback()
        app.logger.error(f'Admin user creation failed: {e}')
        return jsonify({'error': 'User creation failed - please try again'}), 500
    finally:
        release_connection(conn)


@app.route('/admin/users/<int:target_user_id>', methods=['DELETE'])
@jwt_required(fresh=True)
@require_permission('users.delete')
@limiter.limit("20 per day")
def admin_delete_user(target_user_id):
    """Deletes a user account outright - CASCADES to their
    transactions, uploaded_files, personal category_records, and any
    user_permission_overrides row for them (see schema.sql's
    ON DELETE CASCADE foreign keys). No soft-delete or undo.

    Requires a FRESH token - see admin_impersonate_user()'s docstring
    for the full reasoning; same principle applies here, arguably more
    so given this is irreversible.

    Same level-ceiling guard as role assignment: cannot delete a user
    at or above your own level, unless you're the owner. Also refuses
    to let anyone delete their OWN account through this endpoint -
    there's no upside to allowing that here versus the real risk of an
    unrecoverable mistake locking someone out of their only elevated
    account.
    """
    current_user = int(get_jwt_identity())
    if target_user_id == current_user:
        return jsonify({'error': 'Cannot delete your own account through this endpoint'}), 400

    conn = get_connection()
    try:
        caller_role, caller_level, _perms = get_user_role_and_permissions(conn, current_user)
        target = get_user_level(conn, target_user_id)
        if not target:
            return jsonify({'error': 'User not found'}), 404
        if caller_role != 'owner' and target['level'] >= caller_level:
            return jsonify({'error': f'Cannot delete a user at or above your own level ({caller_level})'}), 403

        deleted_username = delete_user(conn, target_user_id)
        conn.commit()
        return jsonify({'status': 'ok', 'deleted_username': deleted_username}), 200
    except ValueError as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        conn.rollback()
        app.logger.error(f'User deletion failed: {e}')
        return jsonify({'error': 'User deletion failed - please try again'}), 500
    finally:
        release_connection(conn)


@app.route('/admin/users/<int:target_user_id>/credentials', methods=['PATCH'])
@jwt_required(fresh=True)
@require_permission('users.edit')
@limiter.limit("20 per day")
def admin_edit_user_credentials(target_user_id):
    """Changes a user's username and/or password - at least one of the
    two must be given, the other is left untouched. New values go
    through the same validate_username()/validate_password() rules as
    signup. Same level-ceiling guard as delete/impersonate: cannot edit
    a user at or above your own level unless you're the owner -
    otherwise a level-50 admin with users.edit could take over the
    owner's account by simply setting a password they know. Requires a
    FRESH token for the same reason - see admin_impersonate_user()'s
    docstring for the full explanation.
    """
    data = request.get_json() or {}
    new_username = data.get('username')
    new_password = data.get('password')

    if new_username is None and new_password is None:
        return jsonify({'error': 'Provide username and/or password'}), 400

    if new_username is not None:
        new_username = new_username.strip()
        error = validate_username(new_username)
        if error:
            return jsonify({'error': error}), 400
    if new_password is not None:
        error = validate_password(new_password)
        if error:
            return jsonify({'error': error}), 400

    current_user = int(get_jwt_identity())
    conn = get_connection()
    try:
        caller_role, caller_level, _perms = get_user_role_and_permissions(conn, current_user)
        target = get_user_level(conn, target_user_id)
        if not target:
            return jsonify({'error': 'User not found'}), 404
        if caller_role != 'owner' and target['level'] >= caller_level:
            return jsonify({'error': f'Cannot edit a user at or above your own level ({caller_level})'}), 403

        new_password_hash = None
        if new_password is not None:
            new_password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt(rounds=12)).decode('utf-8')

        user = update_user_credentials(
            conn, target_user_id,
            new_username=new_username, new_password_hash=new_password_hash,
        )
        conn.commit()
        return jsonify({'user': user}), 200
    except ValueError as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        conn.rollback()
        app.logger.error(f'User credential update failed: {e}')
        return jsonify({'error': 'Update failed - please try again'}), 500
    finally:
        release_connection(conn)


@app.route('/admin/users/<int:target_user_id>/impersonate', methods=['POST'])
@jwt_required(fresh=True)
@require_permission('users.impersonate')
@limiter.limit("20 per day")
def admin_impersonate_user(target_user_id):
    """Issues a fresh, fully valid access token for another user's
    account, without needing or ever seeing their password - "log in
    as them." Same level-ceiling guard as delete/edit: cannot
    impersonate a user at or above your own level, unless you're the
    owner.

    Requires a FRESH token (@jwt_required(fresh=True)) - the caller
    must have just logged in with their actual password (a token
    obtained via /auth/refresh is never fresh, see refresh() above),
    not merely be carrying an old-but-still-technically-valid access
    token. This specifically closes the "a leaked or ambient token can
    silently trigger impersonation" risk: a stolen access token alone
    is not enough, regardless of what client sends the request -
    whoever calls this must have entered a real password recently.

    Deliberately short-lived (IMPERSONATION_TOKEN_EXPIRES, currently 15
    minutes, top of this file) rather than the normal 24h access token
    expiry - an impersonation session is a bounded admin task, not
    something that should be able to linger for a full day. Every call
    here is also logged to impersonation_log (actor, target, jti, when)
    - see handoff5.txt for why an audit trail mattered enough to add,
    and can be individually revoked early via POST /admin/tokens/revoke
    using the jti returned below, without waiting out its expiry.
    """
    current_user = int(get_jwt_identity())
    conn = get_connection()
    try:
        caller_role, caller_level, _perms = get_user_role_and_permissions(conn, current_user)
        target = get_user_level(conn, target_user_id)
        if not target:
            return jsonify({'error': 'User not found'}), 404
        if caller_role != 'owner' and target['level'] >= caller_level:
            return jsonify({'error': f'Cannot impersonate a user at or above your own level ({caller_level})'}), 403

        token = create_access_token(
            identity=str(target_user_id),
            fresh=False,
            expires_delta=IMPERSONATION_TOKEN_EXPIRES,
        )
        jti = decode_token(token)["jti"]

        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO impersonation_log (actor_user_id, target_user_id, jti) VALUES (%s, %s, %s)",
                (current_user, target_user_id, jti),
            )
        conn.commit()

        return jsonify({
            'access_token': token,
            'username': target['username'],
            'jti': jti,
            'expires_in_seconds': int(IMPERSONATION_TOKEN_EXPIRES.total_seconds()),
        }), 200
    except Exception as e:
        conn.rollback()
        app.logger.error(f'Impersonation failed: {e}')
        return jsonify({'error': 'Impersonation failed - please try again'}), 500
    finally:
        release_connection(conn)


@app.route('/admin/impersonation-log', methods=['GET'])
@jwt_required()
@require_permission('audit.view')
@limiter.limit("100 per day")
def admin_impersonation_log():
    """Read-only audit trail of every impersonation ever performed -
    who (actor), whom (target), which token (jti - usable with
    /admin/tokens/revoke below), and when. Gated by its own 'audit.view'
    permission, separate from users.impersonate itself and NOT bundled
    into the 'admin' role by default (see schema.sql) - being ALLOWED
    to impersonate doesn't mean you should also see everyone else's
    impersonation history. Doesn't prevent misuse by itself, but turns
    "we have no way to know if this happened" into "we can check" -
    see handoff5.txt.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT il.id, ua.username, ut.username, il.jti, il.created_at
                   FROM impersonation_log il
                   JOIN users ua ON il.actor_user_id = ua.id
                   JOIN users ut ON il.target_user_id = ut.id
                   ORDER BY il.created_at DESC""",
            )
            rows = cur.fetchall()

        log = [
            {
                'id': row[0],
                'actor': row[1],
                'target': row[2],
                'jti': row[3],
                'created_at': row[4].isoformat(),
            }
            for row in rows
        ]
        return jsonify({'log': log}), 200
    except Exception as e:
        app.logger.error(f'Fetching impersonation log failed: {e}')
        return jsonify({'error': 'Failed to fetch impersonation log'}), 500
    finally:
        release_connection(conn)


@app.route('/admin/tokens/revoke', methods=['POST'])
@jwt_required()
@require_permission('users.impersonate')
@limiter.limit("60 per hour")
def admin_revoke_token():
    """Revokes one specific token by its jti - lets an admin end an
    impersonation session early (wrong user picked, task finished
    ahead of the 15-minute window, etc.) rather than waiting out its
    expiry. Gated by 'users.impersonate' specifically, not a general
    token-management permission - this exists to let you clean up YOUR
    OWN impersonation actions, not as a general-purpose kill-switch for
    arbitrary sessions belonging to someone else.

    Silently succeeds even if the jti doesn't correspond to any
    currently-valid token (already expired, already revoked, never
    existed) - revoking something that's already effectively dead
    isn't an error, the end state ("this jti will not authenticate")
    is identical either way.
    """
    data = request.get_json() or {}
    jti = data.get('jti')
    if not jti:
        return jsonify({'error': 'jti is required'}), 400

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO revoked_tokens (jti) VALUES (%s) ON CONFLICT (jti) DO NOTHING",
                (jti,),
            )
        conn.commit()
        return jsonify({'status': 'ok', 'revoked_jti': jti}), 200
    except Exception as e:
        conn.rollback()
        app.logger.error(f'Token revoke failed: {e}')
        return jsonify({'error': 'Revoke failed - please try again'}), 500
    finally:
        release_connection(conn)


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
        #
        # fresh=True: this token was obtained via an actual password
        # check, this instant - it satisfies @jwt_required(fresh=True)
        # routes (impersonate, delete-user, edit-credentials). A token
        # later obtained via /auth/refresh is deliberately NOT fresh -
        # see refresh() below.
        access_token = create_access_token(identity=str(user_id), fresh=True)
        refresh_token = create_refresh_token(identity=str(user_id))
        return jsonify({'access_token': access_token, 'refresh_token': refresh_token}), 200
    finally:
        release_connection(conn)


def validate_username(username):
    """Returns an error message string, or None if valid. Shared by
    /auth/signup and PATCH /admin/users/<id>/credentials so both
    paths - self-signup and an admin editing someone else's account -
    enforce identical rules and can never quietly drift apart."""
    if not username:
        return 'Username cannot be empty'
    if len(username) < 3:
        return 'Username must be at least 3 characters'
    if len(username) > 30:
        return 'Username must be under 30 characters'
    if not username.replace('_', '').replace('-', '').isalnum():
        return 'Username can only contain letters, numbers, hyphens and underscores'
    return None


def validate_password(password):
    """Returns an error message string, or None if valid. Same sharing
    reasoning as validate_username above."""
    if not password or len(password) < 8:
        return 'Password must be at least 8 characters'
    return None


@app.route('/auth/signup', methods=['POST'])
@limiter.limit("5 per minute")
def signup():
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'username and password required'}), 400

    username = data['username'].strip()
    password = data['password']

    error = validate_username(username) or validate_password(password)
    if error:
        return jsonify({'error': error}), 400

    conn = get_connection()
    try:
        if username_exists(conn, username):
            return jsonify({'error': 'Username already taken'}), 409

        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12))
        new_id = create_user(conn, username, hashed.decode('utf-8'))

        # fresh=True: they just set this password, this instant - same
        # reasoning as login()'s fresh=True above.
        access_token = create_access_token(identity=str(new_id), fresh=True)
        refresh_token = create_refresh_token(identity=str(new_id))
        return jsonify({'access_token': access_token, 'refresh_token': refresh_token}), 201
    except Exception as e:
        conn.rollback()
        app.logger.error(f'Signup failed: {e}')
        return jsonify({'error': 'Signup failed - please try again'}), 500
    finally:
        release_connection(conn)


@app.route('/auth/refresh', methods=['POST'])
@jwt_required(refresh=True)
@limiter.limit("60 per hour")
def refresh():
    """Exchanges a valid REFRESH token for a brand new, short-lived
    ACCESS token - lets the app stay "logged in" across the access
    token's 24h expiry without asking for a password again, right up
    until the refresh token itself (30 days) also expires or is
    revoked. @jwt_required(refresh=True) means this route only accepts
    a refresh token in the Authorization header, not an access token -
    the two are deliberately not interchangeable.

    The new access token is marked fresh=False - it was obtained via a
    refresh, not an actual password entry a moment ago, so it does NOT
    satisfy @jwt_required(fresh=True) routes (impersonate, delete-user,
    edit-credentials). Those specifically require logging in for real,
    on purpose - see admin_impersonate_user()'s docstring.
    """
    current_user = get_jwt_identity()
    new_access_token = create_access_token(identity=current_user, fresh=False)
    return jsonify({'access_token': new_access_token}), 200


@app.route('/auth/logout', methods=['POST'])
@jwt_required()
@limiter.limit("60 per hour")
def logout_route():
    """Actually revokes the calling token server-side - the first time
    "logout" has ever meant anything beyond a device deleting its own
    local copy (see api.js's old logout(), and handoff5.txt for why
    that was never enough on its own). Revokes the ACCESS token this
    very request was authenticated with (its jti/exp are already
    available via get_jwt()) automatically. If a refresh_token is also
    included in the request body, that gets revoked too in the same
    call - decoded and verified via decode_token() (a plain signature
    check, same as any other token verification) rather than trusted
    blindly, so a garbage/malformed value in that field just gets
    silently ignored rather than erroring the whole logout.
    """
    claims = get_jwt()
    jti = claims["jti"]
    exp_ts = claims["exp"]

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO revoked_tokens (jti, expires_at) VALUES (%s, to_timestamp(%s)) ON CONFLICT (jti) DO NOTHING",
                (jti, exp_ts),
            )

        data = request.get_json(silent=True) or {}
        refresh_token_str = data.get('refresh_token')
        if refresh_token_str:
            try:
                decoded = decode_token(refresh_token_str)
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO revoked_tokens (jti, expires_at) VALUES (%s, to_timestamp(%s)) ON CONFLICT (jti) DO NOTHING",
                        (decoded["jti"], decoded["exp"]),
                    )
            except Exception:
                # Not a valid token at all (garbage string, wrong
                # secret, already expired past decode tolerance) -
                # nothing meaningful to revoke, and the ACCESS token
                # revocation above already succeeded regardless, so
                # this is not treated as a hard failure of the whole
                # request.
                pass

        conn.commit()
        return jsonify({'status': 'ok'}), 200
    except Exception as e:
        conn.rollback()
        app.logger.error(f'Logout failed: {e}')
        return jsonify({'error': 'Logout failed'}), 500
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