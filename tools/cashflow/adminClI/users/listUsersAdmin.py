"""
listUsersAdmin.py

Read-only: lists every user, their assigned role, its level, and their
full effective permission set (role bundle + any per-user overrides
already applied - the same combined view the backend itself checks
against, not just the role's default bundle). Reference tool - look
here before using assignRoleAdmin.py or managePermissionsAdmin.py to
see current state first.

Usage:
    python listUsersAdmin.py

Requires: pip install requests

Can also be used from categoryAdminCli.py (the combined menu tool) via
run_list_users(token).
"""

from ..adminCliCommon import BASE_URL, fetch_users, admin_login_prompt


def run_list_users(token):
    """The actual listing, assuming `token` is already an authenticated
    session with at least SOME elevated access. The server itself
    still gates this specific list on the 'users.view' permission -
    getting past admin_login_prompt() (which only checks "has any
    elevated access at all") doesn't guarantee this particular action
    is allowed; a 403 here just means this account isn't one of the
    ones with users.view."""
    try:
        users = fetch_users(token)
    except Exception as e:
        print(f"Couldn't fetch users: {e}\n")
        return

    if not users:
        print("No users found.\n")
        return

    print()
    for u in users:
        perms = ", ".join(u["permissions"]) if u["permissions"] else "(none beyond role defaults' absence)"
        print(f'  {u["username"]} - {u["role"]} (level {u["level"]})')
        print(f'    permissions: {perms}')
    print()


def main():
    print("Cashflow list-users tool")
    print(f"Backend: {BASE_URL}\n")

    token = admin_login_prompt()
    if token is None:
        return

    run_list_users(token)


if __name__ == "__main__":
    main()
