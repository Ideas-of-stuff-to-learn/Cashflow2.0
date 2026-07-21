"""
routes/auth.py

Login, signup, refresh, logout, and "who am I" (/auth/me - used by
both the app's role badge and the CLI's "what am I allowed to do").
Token issuing/expiry/revocation lives here; the actual permission
system (roles, permission checks) lives in permissions.py and
routes/admin.py.
"""
from flask import request, jsonify
from flask_jwt_extended import (
    jwt_required, get_jwt_identity, get_jwt,
    create_access_token, create_refresh_token, decode_token,
    set_access_cookies, set_refresh_cookies, unset_jwt_cookies
)
import bcrypt

from extensions import app, limiter
from database import get_connection, release_connection
from permissions import get_user_role_and_permissions


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
        resp = jsonify({'access_token': access_token, 'refresh_token': refresh_token})
        set_access_cookies(resp, access_token)
        set_refresh_cookies(resp, refresh_token)
        return resp, 200
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
        resp = jsonify({'access_token': access_token, 'refresh_token': refresh_token})
        set_access_cookies(resp, access_token)
        set_refresh_cookies(resp, refresh_token)
        return resp, 201
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
    resp = jsonify({'access_token': new_access_token})
    set_access_cookies(resp, new_access_token)
    return resp, 200


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
        resp = jsonify({'status': 'ok'})
        unset_jwt_cookies(resp)
        return resp, 200
    except Exception as e:
        conn.rollback()
        app.logger.error(f'Logout failed: {e}')
        return jsonify({'error': 'Logout failed'}), 500
    finally:
        release_connection(conn)
