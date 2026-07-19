"""
setDefaultColorAdmin.py

Small admin CLI for changing a category's DEFAULT colour - what "reset
to default" falls back to - without touching its current live colour.
Logs in once, then loops: pick a category by number (shown with its
current colour AND its existing default), pick a new default colour
from the palette or type a custom hex, done - repeat as many times as
you like.

This is the tool schema.sql's comment about categories.default_color
already referenced by name before it actually existed - it's real now.

If you want to change the CURRENT colour instead, use
setColorAdmin.py. If you want to change both at once, use
setColorAndDefaultAdmin.py.


Requires: pip install requests

Can also be used from categoryAdminCli.py (the combined menu tool) via
run_set_default_color(token).
"""

import requests

from ..adminCliCommon import BASE_URL, fetch_categories_full, color_swatch, choose_color, admin_login_prompt,check_response


def set_default_color(token, name, default_color):
    # Uses the existing PATCH /categories/default-color endpoint -
    # already built, already admin-gated, already does exactly this.
    # No backend change needed for this tool either.
    response = requests.patch(
        f"{BASE_URL}/categories/default-color",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_name": name, "default_color": default_color},
    )
    data = check_response(response, "Default colour update failed")
    return data


def choose_category_with_colors(categories):
    """Same idea as setColorAdmin.py's version, but shows BOTH colours
    - current and default - since this tool's whole point is the
    default one, and seeing both together makes it obvious whether
    they're already the same or have drifted apart."""
    print()
    for i, c in enumerate(categories, start=1):
        same = c["color"] == c["defaultColor"]
        default_part = "(same as current)" if same else f"{color_swatch(c['defaultColor'])} {c['defaultColor']}"
        print(f"  {i}. {c['name']} - current: {color_swatch(c['color'])} {c['color']}, default: {default_part}")
    print()

    while True:
        choice = input("Category to change the default colour for (number, or blank to cancel): ").strip()
        if not choice:
            return None
        if not choice.isdigit() or not (1 <= int(choice) <= len(categories)):
            print(f"Enter a number from 1 to {len(categories)}.\n")
            continue
        return categories[int(choice) - 1]


def run_set_default_color(token):
    """The actual set-default-colour workflow, assuming `token` is
    already an authenticated admin session. No login prompt in here -
    see run_rename() in renameCategoryAdmin.py for the same pattern."""
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

        print(f'\nNew default colour for "{chosen["name"]}" (currently {color_swatch(chosen["defaultColor"])} {chosen["defaultColor"]}):')
        new_default = choose_color(existing=categories, old_color=chosen["defaultColor"], old_color_name=chosen["name"])

        try:
            result = set_default_color(token, chosen["name"], new_default)
            print(f'Done - "{result["name"]}"\'s default is now {color_swatch(new_default)} {new_default}. Current colour unchanged.\n')
        except Exception as e:
            print(f"Default colour update failed: {e}\n")

        again = input("Change another default? (y/n): ").strip().lower()
        if again != "y":
            print("Done.")
            break


def main():
    print("Cashflow set-default-colour tool")
    print(f"Backend: {BASE_URL}\n")

    token = admin_login_prompt()
    if token is None:
        return

    run_set_default_color(token)


if __name__ == "__main__":
    main()
