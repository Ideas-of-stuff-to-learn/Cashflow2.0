"""
createUserAdmin.py

Creates a new user account directly - an ADMIN-SIDE alternative to the
person signing themselves up through the app's own Signup screen.
Useful for onboarding someone without needing them to do it themselves,
or for creating throwaway/test accounts.

New accounts are created with the plain 'user' role, same as any
ordinary signup - use assignRoleAdmin.py afterward if this account
should start out elevated.

Requires the 'users.create' permission (bundled into the 'admin' role
by default, and always available to owner).

Usage:
    python createUserAdmin.py

Requires: pip install requests

Can also be used from categoryAdminCli.py (the combined menu tool) via
run_create_user(token).
"""

import getpass

import requests

from adminCliCommon import BASE_URL, admin_login_prompt,check_response


def create_user(token, username, password):
    response = requests.post(
        f"{BASE_URL}/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={"username": username, "password": password},
    )
    data = check_response(response, "User creation failed")
    return data["user"]


def run_create_user(token):
    """The actual create-user workflow, assuming `token` is already an
    authenticated session. No re-login prompt in here - see
    run_rename() in renameCategoryAdmin.py for the same pattern."""
    while True:
        username = input("New username (or blank to cancel): ").strip()
        if not username:
            print("Cancelled.")
            break

        password = getpass.getpass("New password: ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            print("Passwords didn't match.\n")
            continue

        try:
            user = create_user(token, username, password)
            print(f'Done - "{user["username"]}" created as {user["role"]} (level {user["level"]}).\n')
        except Exception as e:
            print(f"Creation failed: {e}\n")

        again = input("Create another? (y/n): ").strip().lower()
        if again != "y":
            print("Done.")
            break


def main():
    print("Cashflow create-user tool")
    print(f"Backend: {BASE_URL}\n")

    token = admin_login_prompt()
    if token is None:
        return

    run_create_user(token)


if __name__ == "__main__":
    main()
