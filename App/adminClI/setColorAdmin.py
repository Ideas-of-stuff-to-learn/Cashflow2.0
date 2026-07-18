"""
setColorAdmin.py

Small admin CLI for changing a category's CURRENT colour - the one
shown in the app right now - without touching its default colour (the
one "reset to default" falls back to). Logs in once, then loops: pick
a category by number (shown with its current colour swatch), pick a
new colour from the palette or type a custom hex, done - repeat as
many times as you like.

If you want to change the DEFAULT colour instead, use
setDefaultColorAdmin.py. If you want to change both at once, use
setColorAndDefaultAdmin.py.

Usage:
    python setColorAdmin.py

Requires: pip install requests

Can also be used from categoryAdminCli.py (the combined menu tool) via
run_set_color(token).
"""

import requests

from adminCliCommon import BASE_URL, fetch_categories_full, color_swatch, choose_color, admin_login_prompt


def set_color(token, name, color):
    # Deliberately reuses the existing PATCH /categories endpoint (the
    # same one rename uses) rather than a new route - it already
    # supports a colour-only change (current_name + color, no
    # new_name) and already leaves default_color untouched when color
    # is the only field given. No backend change needed for this tool.
    response = requests.patch(
        f"{BASE_URL}/categories",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_name": name, "color": color},
    )
    data = response.json()
    if not response.ok:
        raise RuntimeError(data.get("error", "Colour update failed"))
    return data


def choose_category_with_colors(categories):
    """Same shape as adminCliCommon.choose_category(), but shows each
    category's current colour swatch alongside its name - the whole
    point of this tool is picking based on colour, so a plain name
    list wouldn't be enough context to choose from."""
    print()
    for i, c in enumerate(categories, start=1):
        print(f"  {i}. {color_swatch(c['color'])} {c['name']} - {c['color']}")
    print()

    while True:
        choice = input("Category to recolour (number, or blank to cancel): ").strip()
        if not choice:
            return None
        if not choice.isdigit() or not (1 <= int(choice) <= len(categories)):
            print(f"Enter a number from 1 to {len(categories)}.\n")
            continue
        return categories[int(choice) - 1]


def run_set_color(token):
    """The actual set-color workflow, assuming `token` is already an
    authenticated admin session. No login prompt in here - see
    run_rename() in renameCategoryAdmin.py for the same pattern."""
    while True:
        try:
            categories = fetch_categories_full(token)
        except Exception as e:
            print(f"Couldn't fetch categories: {e}\n")
            break

        chosen = choose_category_with_colors(categories)
        if chosen is None:
            print("Cancelled.")
            break

        print(f'\nNew colour for "{chosen["name"]}" (currently {color_swatch(chosen["color"])} {chosen["color"]}):')
        new_color = choose_color(existing=categories, old_color=chosen["color"], old_color_name=chosen["name"])

        try:
            result = set_color(token, chosen["name"], new_color)
            print(f'Done - "{result["name"]}" is now {color_swatch(new_color)} {new_color}. Default colour unchanged.\n')
        except Exception as e:
            print(f"Colour update failed: {e}\n")

        again = input("Recolour another? (y/n): ").strip().lower()
        if again != "y":
            print("Done.")
            break


def main():
    print("Cashflow set-colour tool")
    print(f"Backend: {BASE_URL}\n")

    token = admin_login_prompt()
    if token is None:
        return

    run_set_color(token)


if __name__ == "__main__":
    main()
