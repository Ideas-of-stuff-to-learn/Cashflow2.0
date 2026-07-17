"""
add_category.py

Small admin CLI for adding a brand new category on the deployed
backend. Logs in once, then loops: give the new category a name, and
it's assigned a randomly generated colour that's guaranteed distinct
from every colour already in use (say no and it'll generate another
until you're happy) - no palette to pick through, no custom hex to
type, just a fresh non-clashing colour handed to you. Repeat as many
times as you like.

Usage:
    python add_category.py

Requires: pip install requests

Can also be used from categoryAdminCli.py (the combined menu tool) via
run_add(token).
"""

import requests

from adminCliCommon import BASE_URL, fetch_categories_full, auto_generate_unique_color, admin_login_prompt


def create_category(token, name, color):
    response = requests.post(
        f"{BASE_URL}/categories",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": name, "color": color},
    )
    data = response.json()
    if not response.ok:
        raise RuntimeError(data.get("error", "Category creation failed"))
    return data


def run_add(token):
    """The actual add-category workflow, assuming `token` is already an
    authenticated admin session. No login prompt in here - see
    run_rename() in renameCategoryAdmin.py for the same pattern."""
    while True:
        try:
            existing = fetch_categories_full(token)
        except Exception as e:
            print(f"Couldn't fetch categories: {e}\n")
            break

        print("Current categories:")
        for c in existing:
            print(f"  - {c['name']}")

        name = input("\nName for the new category: ").strip()
        if not name:
            print("Name can't be empty.\n")
            continue

        print(f'\nGenerating a colour for "{name}"...')
        color = auto_generate_unique_color(existing_colors=[c["color"] for c in existing])

        try:
            result = create_category(token, name, color)
            print(f'Done - added "{result["name"]}" ({result["color"]}).\n')
        except Exception as e:
            print(f"Creation failed: {e}\n")

        again = input("Add another? (y/n): ").strip().lower()
        if again != "y":
            print("Done.")
            break


def main():
    print("Cashflow add-category tool")
    print(f"Backend: {BASE_URL}\n")

    token = admin_login_prompt()
    if token is None:
        return

    run_add(token)


if __name__ == "__main__":
    main()
