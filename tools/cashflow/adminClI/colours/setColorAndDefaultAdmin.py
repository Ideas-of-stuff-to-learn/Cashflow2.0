"""
setColorAndDefaultAdmin.py

Same picker UI as setColorAdmin.py, plus one extra question: whether
to ALSO set the default colour to match the new colour, in the same
pass. Useful when you're deciding on a genuinely new "true" colour for
a category, rather than a one-off tweak to the current colour that
should still fall back to the old default on reset.

Doesn't duplicate the underlying colour-setting logic - calls the
exact same set_color() (setColorAdmin.py) and set_default_color()
(setDefaultColorAdmin.py) functions the other two tools use, just
gives you the option to fire both from one prompt instead of running
two separate tools back to back.



Requires: pip install requests

Can also be used from categoryAdminCli.py (the combined menu tool) via
run_set_color_and_default(token).
"""

from ..adminCliCommon import BASE_URL, fetch_categories_full, color_swatch, choose_color, admin_login_prompt
from .setColorAdmin import set_color, choose_category_with_colors


def run_set_color_and_default(token):
    """The actual workflow, assuming `token` is already an
    authenticated admin session. No login prompt in here - see
    run_rename() in renameCategoryAdmin.py for the same pattern."""
    # Imported here, not at module level, purely to avoid a confusing
    # name collision with setColorAdmin's own set_color import above -
    # both files' internals stay independently readable this way.
    from App.adminClI.colours.setDefaultColorAdmin import set_default_color

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

        also_default = input(
            f'Also set this as the default colour (currently {chosen["defaultColor"]})? (y/n): '
        ).strip().lower() == "y"

        try:
            result = set_color(token, chosen["name"], new_color)
        except Exception as e:
            print(f"Colour update failed: {e}\n")
            again = input("Do another? (y/n): ").strip().lower()
            if again != "y":
                print("Done.")
                break
            continue

        message = f'Done - "{result["name"]}" is now {color_swatch(new_color)} {new_color}.'

        if also_default:
            try:
                set_default_color(token, chosen["name"], new_color)
                message += " Default colour updated to match."
            except Exception as e:
                # The colour change above already succeeded and is NOT
                # rolled back just because this second, separate call
                # failed - say so plainly rather than implying nothing
                # happened.
                message += f" Colour change succeeded, but updating the default failed: {e}"
        else:
            message += " Default colour unchanged."

        print(message + "\n")

        again = input("Do another? (y/n): ").strip().lower()
        if again != "y":
            print("Done.")
            break


def main():
    print("Cashflow set-colour-and-default tool")
    print(f"Backend: {BASE_URL}\n")

    token = admin_login_prompt()
    if token is None:
        return

    run_set_color_and_default(token)


if __name__ == "__main__":
    main()
