"""
add_category.py

Small admin CLI for adding a brand new category on the deployed
backend. Logs in once, then loops: give the new category a name, pick
a colour from the same palette the app's colour picker uses (or type
a custom hex), and it's created - repeat as many times as you like.

Usage:
    python add_category.py

Requires: pip install requests

Can also be used from categoryAdminCli.py (the combined menu tool) via
run_add(token).
"""

import requests

from adminCliCommon import BASE_URL, fetch_categories, admin_login_prompt

# Same palette as COLOR_PALETTE in App/utils/charts/chartUtils.js - kept
# in sync manually since this is a standalone script, not a shared
# import. If that palette changes, update this list too.
COLOR_PALETTE = [
    '#2E5C8A', '#E07A3E', '#3D8B5F', '#9B3D8A', '#C4A227',
    '#D94F4F', '#4FA8D9', '#7A5C3D', '#5C8A2E', '#D97AB8',
    '#3D5C8A', '#8A3D3D', '#4DBFBF', '#A67C52',
]


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


def choose_color():
    print()
    for i, color in enumerate(COLOR_PALETTE, start=1):
        print(f"  {i}. {color}")
    print(f"  {len(COLOR_PALETTE) + 1}. Type a custom hex colour")
    print()

    while True:
        choice = input("Colour (number): ").strip()
        if not choice.isdigit():
            print("Enter a number.\n")
            continue
        n = int(choice)
        if 1 <= n <= len(COLOR_PALETTE):
            return COLOR_PALETTE[n - 1]
        if n == len(COLOR_PALETTE) + 1:
            custom = input("Hex colour (e.g. #3D8B5F): ").strip()
            if not custom.startswith('#') or len(custom) != 7:
                print("Must look like #RRGGBB.\n")
                continue
            return custom
        print(f"Enter a number from 1 to {len(COLOR_PALETTE) + 1}.\n")


def run_add(token):
    """The actual add-category workflow, assuming `token` is already an
    authenticated admin session. No login prompt in here - see
    run_rename() in renameCategoryAdmin.py for the same pattern."""
    while True:
        try:
            existing = fetch_categories(token)
        except Exception as e:
            print(f"Couldn't fetch categories: {e}\n")
            break

        print("Current categories:")
        for c in existing:
            print(f"  - {c}")

        name = input("\nName for the new category: ").strip()
        if not name:
            print("Name can't be empty.\n")
            continue

        color = choose_color()

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
