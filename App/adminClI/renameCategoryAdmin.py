"""
rename_category.py

Small admin CLI for renaming categories on the deployed backend, without
having to hand-craft curl commands each time. Logs in once, then loops
asking which category to rename (picked by number from a live list) and
what to rename it to, until you're done.

Usage:
    python rename_category.py

Requires: pip install requests

Can also be used from categoryAdminCli.py (the combined menu tool) via
run_rename(token) - that's why the loop logic lives in its own function
separate from main(), rather than only being reachable by running this
file directly.
"""

import requests

from .adminCliCommon import BASE_URL, fetch_categories, choose_category, admin_login_prompt,check_response


def rename_category(token, old_name, new_name):
    # current_name travels in the request BODY now, not the URL path -
    # some category names contain a literal "/" (e.g. "Sports/Fitness"),
    # and a URL-encoded slash (%2F) is handled specially by a lot of web
    # infrastructure for security reasons, which meant it could get
    # rejected or mismatched before Flask's own routing ever saw it -
    # regardless of URL-encoding it correctly on this end. Request
    # bodies have no such restriction on any character.
    response = requests.patch(
        f"{BASE_URL}/categories",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_name": old_name, "new_name": new_name},
    )
    data = check_response(response, "Rename failed")
    return data


def run_rename(token):
    """The actual rename workflow, assuming `token` is already an
    authenticated admin session - loops asking which category to
    rename and what to rename it to, until the user backs out or says
    no to "rename another?". No login prompt in here - that's the
    caller's job (either main() below, standalone, or
    categoryAdminCli.py, once for the whole session)."""
    while True:
        try:
            categories = fetch_categories(token)
        except Exception as e:
            print(f"Couldn't fetch categories: {e}\n")
            break

        old_name = choose_category(categories, "Category to rename")
        if old_name is None:
            print("Cancelled.")
            break

        new_name = input(f'New name for "{old_name}": ').strip()
        if not new_name:
            print("New name can't be empty.\n")
            continue

        try:
            result = rename_category(token, old_name, new_name)
            print(f"Done - renamed to \"{result['name']}\".\n")
        except Exception as e:
            print(f"Rename failed: {e}\n")

        again = input("Rename another? (y/n): ").strip().lower()
        if again != "y":
            print("Done.")
            break


def main():
    print("Cashflow category rename tool")
    print(f"Backend: {BASE_URL}\n")

    token = admin_login_prompt()
    if token is None:
        return

    run_rename(token)


if __name__ == "__main__":
    main()
