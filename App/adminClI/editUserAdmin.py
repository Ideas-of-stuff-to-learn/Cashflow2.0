"""
editUserAdmin.py

Edits a user's username and/or password directly - useful for
account-recovery scenarios (they forgot their password and this app
has no self-service reset flow) or fixing a typo'd username without
deleting and recreating the whole account.

Hierarchy guard (also enforced server-side): you can only edit a user
at a level BELOW your own. Owner has no ceiling - this specifically
prevents a lower-tier admin from taking over a higher-privileged
account by simply setting a password they know.

Requires the 'users.edit' permission (bundled into the 'admin' role by
default, and always available to owner).

Usage:
    python editUserAdmin.py

Requires: pip install requests

Can also be used from categoryAdminCli.py (the combined menu tool) via
run_edit_user(token).
"""

import getpass

import requests

from adminCliCommon import BASE_URL, fetch_me, fetch_users, choose_from_list, admin_login_prompt


def edit_user_credentials(token, user_id, username=None, password=None):
    body = {}
    if username is not None:
        body["username"] = username
    if password is not None:
        body["password"] = password
    response = requests.patch(
        f"{BASE_URL}/admin/users/{user_id}/credentials",
        headers={"Authorization": f"Bearer {token}"},
        json=body,
    )
    data = response.json()
    if not response.ok:
        raise RuntimeError(data.get("error", "Update failed"))
    return data["user"]


def run_edit_user(token):
    """The actual edit-credentials workflow, assuming `token` is
    already an authenticated session. No re-login prompt in here - see
    run_rename() in renameCategoryAdmin.py for the same pattern."""
    try:
        me = fetch_me(token)
    except Exception as e:
        print(f"Couldn't fetch your own account info: {e}\n")
        return

    while True:
        try:
            users = fetch_users(token)
        except Exception as e:
            print(f"Couldn't fetch users: {e}\n")
            break

        editable = [u for u in users if me["role"] == "owner" or u["level"] < me["level"]]
        if not editable:
            print("\nNo users available for you to edit.\n")
            break

        chosen = choose_from_list(
            editable,
            lambda u: f'{u["username"]} - {u["role"]} (level {u["level"]})',
            prompt="User to edit",
        )
        if chosen is None:
            print("Cancelled.")
            break

        print("\n  1. Change username")
        print("  2. Change password")
        print("  3. Both")
        print("  4. Cancel")
        action = input("What to change (number): ").strip()
        if action not in ("1", "2", "3"):
            print("Cancelled.\n")
            continue

        new_username = None
        new_password = None

        if action in ("1", "3"):
            new_username = input(f'New username (currently "{chosen["username"]}", blank to leave unchanged): ').strip() or None

        if action in ("2", "3"):
            pw = getpass.getpass("New password (blank to leave unchanged): ")
            if pw:
                confirm = getpass.getpass("Confirm new password: ")
                if pw != confirm:
                    print("Passwords didn't match - password left unchanged.\n")
                else:
                    new_password = pw

        if new_username is None and new_password is None:
            print("Nothing to change.\n")
        else:
            try:
                result = edit_user_credentials(token, chosen["id"], username=new_username, password=new_password)
                print(f'Done - account is now "{result["username"]}".\n')
            except Exception as e:
                print(f"Update failed: {e}\n")

        again = input("Edit another? (y/n): ").strip().lower()
        if again != "y":
            print("Done.")
            break


def main():
    print("Cashflow edit-user tool")
    print(f"Backend: {BASE_URL}\n")

    token = admin_login_prompt()
    if token is None:
        return

    run_edit_user(token)


if __name__ == "__main__":
    main()
