"""
routes/admin.py

Everything that manages OTHER people's roles/permissions/accounts, plus
impersonation and its audit log/token revocation. Each endpoint is
gated by its own specific permission key via require_permission() (see
permissions.py) - there is no single "is_admin" shortcut anywhere here,
same convention as routes/categories.py.
"""
from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token, decode_token
import bcrypt

from extensions import app, limiter, IMPERSONATION_TOKEN_EXPIRES
from database import get_connection, release_connection
from permissions import (
    require_permission, get_user_role_and_permissions,
    list_all_permissions, list_all_roles, list_all_users,
    get_role_by_name, create_role, update_role, delete_role,
    assign_user_role, set_user_permission_override,
    get_user_level, delete_user, update_user_credentials,
)


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


