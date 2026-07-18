"""
impersonateUserAdmin.py

Generates a valid access token for another user's account - "log in as
them" - without needing or ever seeing their password. Useful for
reproducing a bug report or checking what someone's account actually
looks like.

Hierarchy guard (also enforced server-side): you can only impersonate
a user at a level BELOW your own. Owner has no ceiling.

WORTH KNOWING: this app's access tokens never expire, and there is no
server-side way to revoke one once issued - logging "out" only deletes
the token from the device's local storage, it doesn't invalidate the
token itself. A token generated here is valid indefinitely, exactly
like a normal login token would be, with no separate expiry the
impersonated person could rely on to end it on their own, and no audit
trail beyond backend logs of when this was used or by whom. Use this
deliberately, not casually.

Requires the 'users.impersonate' permission (bundled into the 'admin'
role by default, and always available to owner).

Usage:
    python impersonateUserAdmin.py

Requires: pip install requests

Can also be used from categoryAdminCli.py (the combined menu tool) via
run_impersonate_user(token).
"""

import requests

from adminCliCommon import BASE_URL, fetch_me, fetch_users, choose_from_list, admin_login_prompt


def impersonate_user(token, user_id):
    response = requests.post(
        f"{BASE_URL}/admin/users/{user_id}/impersonate",
        headers={"Authorization": f"Bearer {token}"},
    )
    data = response.json()
    if not response.ok:
        raise RuntimeError(data.get("error", "Impersonation failed"))
    return data


def run_impersonate_user(token):
    """The actual impersonate workflow, assuming `token` is already an
    authenticated session. No re-login prompt in here - see
    run_rename() in renameCategoryAdmin.py for the same pattern."""
    try:
        me = fetch_me(token)
    except Exception as e:
        print(f"Couldn't fetch your own account info: {e}\n")
        return

    try:
        users = fetch_users(token)
    except Exception as e:
        print(f"Couldn't fetch users: {e}\n")
        return

    impersonatable = [u for u in users if me["role"] == "owner" or u["level"] < me["level"]]
    if not impersonatable:
        print("\nNo users available for you to impersonate.\n")
        return

    chosen = choose_from_list(
        impersonatable,
        lambda u: f'{u["username"]} - {u["role"]} (level {u["level"]})',
        prompt="User to log in as",
    )
    if chosen is None:
        print("Cancelled.")
        return

    print(f'\nThis generates a real, indefinitely-valid login token for "{chosen["username"]}" - see the warning at the top of this file.')
    confirm = input("Continue? (y/n): ").strip().lower()
    if confirm != "y":
        print("Cancelled.")
        return

    try:
        result = impersonate_user(token, chosen["id"])
        print(f'\nAccess token for "{result["username"]}":\n\n  {result["access_token"]}\n')
        print('Use this as the "Authorization: Bearer <token>" header to act as this account (e.g. via curl or Postman).')
    except Exception as e:
        print(f"Impersonation failed: {e}\n")


def main():
    print("Cashflow impersonate-user tool")
    print(f"Backend: {BASE_URL}\n")

    token = admin_login_prompt()
    if token is None:
        return

    run_impersonate_user(token)


if __name__ == "__main__":
    main()
