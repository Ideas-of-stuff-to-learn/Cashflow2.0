"""
delete_category.py

Small admin CLI for deleting a category entirely on the deployed
backend. Logs in once, then loops: pick a category by number from a
live list, confirm (this reassigns anything currently in it to
"MANUALLY CATEGORISE" and cannot be undone), and it's gone.

If you want a category's data to end up in some OTHER real category
rather than manual review, use combine_category.py instead - this
tool is specifically for abandoning a category altogether.

Usage:
    python delete_category.py

Requires: pip install requests

Can also be used from categoryAdminCli.py (the combined menu tool) via
run_delete(token).
"""

import requests

from adminCliCommon import BASE_URL, fetch_categories, choose_category, admin_login_prompt,check_response


def delete_category(token, name):
    response = requests.delete(
        f"{BASE_URL}/categories",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": name},
    )
    data = check_response(response, "Delete failed")
    return data


def run_delete(token):
    """The actual delete workflow, assuming `token` is already an
    authenticated admin session. No login prompt in here - see
    run_rename() in renameCategoryAdmin.py for the same pattern."""
    while True:
        try:
            categories = fetch_categories(token)
        except Exception as e:
            print(f"Couldn't fetch categories: {e}\n")
            break

        name = choose_category(categories, "Category to delete")
        if name is None:
            print("Cancelled.")
            break

        confirm = input(
            f'Delete "{name}"? Any transactions currently in it will be '
            f'reassigned to "MANUALLY CATEGORISE". This cannot be undone. '
            f'(y/n): '
        ).strip().lower()
        if confirm != "y":
            print("Cancelled.\n")
            continue

        try:
            result = delete_category(token, name)
            print(
                f'Done - deleted "{result["deleted"]}", reassigned '
                f'{result["reassigned_transactions"]} transaction(s) to manual review.\n'
            )
        except Exception as e:
            print(f"Delete failed: {e}\n")

        again = input("Delete another? (y/n): ").strip().lower()
        if again != "y":
            print("Done.")
            break


def main():
    print("Cashflow delete-category tool")
    print(f"Backend: {BASE_URL}\n")

    token = admin_login_prompt()
    if token is None:
        return

    run_delete(token)


if __name__ == "__main__":
    main()
