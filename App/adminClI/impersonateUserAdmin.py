"""
impersonateUserAdmin.py

Generates a valid access token for another user's account - "log in as
them" - without needing or ever seeing their password. Useful for
reproducing a bug report or checking what someone's account actually
looks like.

Hierarchy guard (also enforced server-side): you can only impersonate
a user at a level BELOW your own. Owner has no ceiling.

Requires a FRESH login - the backend rejects this action if your
token was obtained via a silent refresh rather than an actual password
entry (@jwt_required(fresh=True), see backend.py). Since
admin_login_prompt() always does a real password login every time this
CLI is run, this never adds friction in practice here - it's a real
constraint, but one this tool's own login flow already satisfies by
construction.

The generated token is short-lived (15 minutes, not the normal 24h
access-token lifetime - see IMPERSONATION_TOKEN_EXPIRES in backend.py)
and every use of this action is recorded in the impersonation audit log
(see listImpersonationLogAdmin.py) - who, whom, when. You can also
revoke the token immediately once you're done with it, rather than
leaving it valid for the rest of its 15-minute window - this tool
offers that right after generating one.

Requires the 'users.impersonate' permission (bundled into the 'admin'
role by default, and always available to owner).

Usage:
    python impersonateUserAdmin.py

Requires: pip install requests

Can also be used from categoryAdminCli.py (the combined menu tool) via
run_impersonate_user(token).
"""

import requests

from adminCliCommon import BASE_URL, fetch_me, fetch_users, choose_from_list, admin_login_prompt, check_response, revoke_token


def impersonate_user(token, user_id):
    response = requests.post(
        f"{BASE_URL}/admin/users/{user_id}/impersonate",
        headers={"Authorization": f"Bearer {token}"},
    )
    return check_response(response, "Impersonation failed")


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

    print(f'\nThis generates a real login token for "{chosen["username"]}", valid for 15 minutes and logged to the impersonation audit trail.')
    confirm = input("Continue? (y/n): ").strip().lower()
    if confirm != "y":
        print("Cancelled.")
        return

    try:
        result = impersonate_user(token, chosen["id"])
    except Exception as e:
        print(f"Impersonation failed: {e}\n")
        return

    print(f'\nAccess token for "{result["username"]}" (expires in {result["expires_in_seconds"] // 60} minutes):\n')
    print(f'  {result["access_token"]}\n')
    print('Use this as the "Authorization: Bearer <token>" header to act as this account (e.g. via curl or Postman).')

    done = input("\nDone with this session now? Revoke it immediately instead of waiting out the 15 minutes? (y/n): ").strip().lower()
    if done == "y":
        try:
            revoke_token(token, result["jti"])
            print("Revoked - that token no longer works.\n")
        except Exception as e:
            print(f"Revoke failed (the token will still expire naturally in 15 minutes regardless): {e}\n")
    else:
        print("Left active - it will expire on its own.\n")


def main():
    print("Cashflow impersonate-user tool")
    print(f"Backend: {BASE_URL}\n")

    token = admin_login_prompt()
    if token is None:
        return

    run_impersonate_user(token)


if __name__ == "__main__":
    main()
