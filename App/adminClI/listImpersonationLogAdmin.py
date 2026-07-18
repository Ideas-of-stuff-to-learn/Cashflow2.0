"""
listImpersonationLogAdmin.py

Read-only: shows every impersonation ever performed - who (actor), whom
(target), and when, newest first. Doesn't prevent misuse by itself,
but turns "we have no way to know if this happened" into "we can
check" - see handoff5.txt for why this mattered enough to add.

Requires the 'audit.view' permission - deliberately NOT bundled into
the 'admin' role by default (see schema.sql), and separate from
'users.impersonate' itself: being allowed to impersonate doesn't mean
you should also see everyone else's impersonation history. Owner
always has this regardless.

Usage:
    python listImpersonationLogAdmin.py

Requires: pip install requests

Can also be used from categoryAdminCli.py (the combined menu tool) via
run_list_impersonation_log(token).
"""

from adminCliCommon import BASE_URL, fetch_impersonation_log, admin_login_prompt


def run_list_impersonation_log(token):
    """The actual listing, assuming `token` is already an authenticated
    session with at least SOME elevated access. The server itself
    still gates this specific list on the 'audit.view' permission -
    getting past admin_login_prompt() doesn't guarantee this particular
    action is allowed; a failure here just means this account isn't
    one of the ones with audit.view."""
    try:
        log = fetch_impersonation_log(token)
    except Exception as e:
        print(f"Couldn't fetch the impersonation log: {e}\n")
        return

    if not log:
        print("\nNo impersonations recorded yet.\n")
        return

    print()
    for entry in log:
        print(f'  {entry["created_at"]}  {entry["actor"]} -> {entry["target"]}  (jti: {entry["jti"]})')
    print()


def main():
    print("Cashflow impersonation-log tool")
    print(f"Backend: {BASE_URL}\n")

    token = admin_login_prompt()
    if token is None:
        return

    run_list_impersonation_log(token)


if __name__ == "__main__":
    main()
