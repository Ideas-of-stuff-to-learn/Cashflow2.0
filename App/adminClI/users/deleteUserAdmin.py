"""
deleteUserAdmin.py

Deletes a user account outright - CASCADES to that user's
transactions, uploaded files, personal category data, and any
individual permission overrides for them (see schema.sql's
ON DELETE CASCADE foreign keys). There is no soft-delete, undo, or
recovery - this is permanent the moment it's confirmed. Requires typing
the exact username back as confirmation, not just a y/n, given how
irreversible this action is.

Hierarchy guard (also enforced server-side): you can only delete a
user at a level BELOW your own. Owner has no ceiling. You also cannot
delete your OWN account through this tool, even as owner - there's no
upside to allowing that versus a genuine mistake locking you out.

Requires the 'users.delete' permission (bundled into the 'admin' role
by default, and always available to owner).

Usage:
    python deleteUserAdmin.py

Requires: pip install requests

Can also be used from categoryAdminCli.py (the combined menu tool) via
run_delete_user(token).
"""

import requests

from ..adminCliCommon import BASE_URL, fetch_me, fetch_users, choose_from_list, admin_login_prompt,check_response


def delete_user(token, user_id):
    response = requests.delete(
        f"{BASE_URL}/admin/users/{user_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    data = check_response(response, "User deletion failed")
    return data


def run_delete_user(token):
    """The actual delete-user workflow, assuming `token` is already an
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
        except Exception as e:
            print(f"Couldn't fetch users: {e}\n")
            break

        # Client-side mirror of the server's own guards - never even
        # OFFER your own account or something the server will reject
        # anyway. The server re-checks both regardless (see
        # delete_user()'s docstring above).
        deletable = [
            u for u in users
            if u["username"] != me["username"] and (me["role"] == "owner" or u["level"] < me["level"])
        ]

        if not deletable:
            print("\nNo users available for you to delete.\n")
            break

        chosen = choose_from_list(
            deletable,
            lambda u: f'{u["username"]} - {u["role"]} (level {u["level"]})',
            prompt="User to delete",
        )
        if chosen is None:
            print("Cancelled.")
            break

        print(f'\nDelete "{chosen["username"]}"? This permanently removes their transactions, uploads, and category data too. This CANNOT be undone.')
        confirm = input(f'Type the username ("{chosen["username"]}") to confirm, or leave blank to cancel: ').strip()
        if confirm != chosen["username"]:
            print("Cancelled.\n")
        else:
            try:
                delete_user(token, chosen["id"])
                print(f'Done - "{chosen["username"]}" deleted.\n')
            except Exception as e:
                print(f"Deletion failed: {e}\n")

        again = input("Delete another? (y/n): ").strip().lower()
        if again != "y":
            print("Done.")
            break


def main():
    print("Cashflow delete-user tool")
    print(f"Backend: {BASE_URL}\n")

    token = admin_login_prompt()
    if token is None:
        return

    run_delete_user(token)


if __name__ == "__main__":
    main()
