"""
assignRoleAdmin.py

Assigns a role to a user - the "make this person an admin" (or demote
them, or hand out a custom role) tool. Logs in once, then loops: pick a
user by number (shown with their current role), pick a role to give
them, confirm, done - repeat as many times as you like.

Hierarchy guard (also enforced server-side, see /admin/users/<id>/role
in backend.py - this is a convenience filter, not the real gate): you
can only assign a role BELOW your own level. The owner has no ceiling
and can assign anything, including the owner role itself to someone
else. This stops a lower-tier admin from promoting someone (including
via a second account) to their own tier or above, which would make
"levels" meaningless.

Usage:
    python assignRoleAdmin.py

Requires: pip install requests

Can also be used from categoryAdminCli.py (the combined menu tool) via
run_assign_role(token).
"""

import requests

from .adminCliCommon import BASE_URL, fetch_me, fetch_users, fetch_roles, choose_from_list, admin_login_prompt, check_response


def assign_role(token, user_id, role_name):
    response = requests.patch(
        f"{BASE_URL}/admin/users/{user_id}/role",
        headers={"Authorization": f"Bearer {token}"},
        json={"role": role_name},
    )

    data = check_response(response, "Role assignment failed")
    return data["user"]

def run_assign_role(token):
    """The actual assign-role workflow, assuming `token` is already an
    authenticated session. No re-login prompt in here - see
    run_rename() in renameCategoryAdmin.py for the same pattern."""
    try:
        me = fetch_me(token)
    except Exception as e:
        print(f"Couldn't fetch your own account info: {e}\n")
        return

    while True:
        try:
            users = fetch_users(token)
            roles = fetch_roles(token)
        except Exception as e:
            print(f"Couldn't fetch users/roles: {e}\n")
            break

        chosen_user = choose_from_list(
            users,
            lambda u: f'{u["username"]} - currently {u["role"]} (level {u["level"]})',
            prompt="User to reassign",
        )
        if chosen_user is None:
            print("Cancelled.")
            break

        # Client-side mirror of the server's own hierarchy guard - owner
        # sees every role, everyone else only sees roles strictly below
        # their own level. This is purely so the picker doesn't even
        # OFFER something the server will reject anyway; the server
        # re-checks this itself regardless (see assign_role() above's
        # docstring), so there's no way to bypass it by editing this
        # script.
        if me["role"] == "owner":
            assignable_roles = roles
        else:
            assignable_roles = [r for r in roles if r["level"] < me["level"]]

        if not assignable_roles:
            print(f'\nNo roles available for you to assign (your level is {me["level"]}).\n')
            break

        chosen_role = choose_from_list(
            assignable_roles,
            lambda r: f'{r["name"]} (level {r["level"]}) - {", ".join(r["permissions"]) or "(no permissions)"}',
            prompt="New role",
        )
        if chosen_role is None:
            print("Cancelled.")
            break

        print(f'\nAssign "{chosen_role["name"]}" to "{chosen_user["username"]}" (currently {chosen_user["role"]})?')
        confirm = input("Confirm? (y/n): ").strip().lower()
        if confirm != "y":
            print("Skipped.\n")
        else:
            try:
                result = assign_role(token, chosen_user["id"], chosen_role["name"])
                print(f'Done - "{result["username"]}" is now {result["role"]} (level {result["level"]}).\n')
            except Exception as e:
                print(f"Assignment failed: {e}\n")

        again = input("Assign another? (y/n): ").strip().lower()
        if again != "y":
            print("Done.")
            break


def main():
    print("Cashflow assign-role tool")
    print(f"Backend: {BASE_URL}\n")

    token = admin_login_prompt()
    if token is None:
        return

    run_assign_role(token)


if __name__ == "__main__":
    main()
