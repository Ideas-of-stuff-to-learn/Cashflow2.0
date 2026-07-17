"""
resetColorAdmin.py

Small admin CLI for resetting a category's CURRENT colour back to its
DEFAULT colour - the "undo my one-off recolour" tool. Logs in once,
then loops: either pick ONE category by number (shown with both its
current and default colour, so it's obvious which ones have actually
drifted apart and which are already at default) or choose "reset ALL",
confirm, done - repeat as many times as you like.

Deliberately no colour picker here - unlike setColorAdmin.py /
setDefaultColorAdmin.py / setColorAndDefaultAdmin.py, there's nothing
to choose. The target colour is always whatever `defaultColor` already
is for that category; this tool's only job is applying it to `color`.

The bulk "reset ALL" path only ever touches categories whose `color`
has actually drifted from `defaultColor` - one already at default is
left alone (there's nothing to change, and re-sending the same value
would just be a no-op API call for no reason). One confirmation covers
the whole batch; each category is then reset one at a time, and a
per-category failure doesn't stop the rest from being attempted -
everything is reported at the end, success and failure both.

If you want to set the current colour to something else entirely, use
setColorAdmin.py. If you want to change what the DEFAULT itself is,
use setDefaultColorAdmin.py.

Usage:
    python resetColorAdmin.py

Requires: pip install requests

Can also be used from categoryAdminCli.py (the combined menu tool) via
run_reset_color(token).
"""

from adminCliCommon import BASE_URL, fetch_categories_full, color_swatch, admin_login_prompt
from setColorAdmin import set_color


ALL = "ALL"  # sentinel returned by choose_category_to_reset() for the bulk path


def choose_category_to_reset(categories):
    """Same idea as setDefaultColorAdmin.py's picker - shows both
    colours side by side - but the framing here is the opposite
    direction: this tool cares about categories where `color` has
    DRIFTED from `defaultColor`, since those are the ones worth
    resetting. Categories already at default are shown too (so the
    list stays complete and predictable), just labelled as such rather
    than hidden.

    Returns a single category dict, the ALL sentinel (bulk path), or
    None (cancelled)."""
    print()
    for i, c in enumerate(categories, start=1):
        same = c["color"] == c["defaultColor"]
        if same:
            print(f"  {i}. {c['name']} - {color_swatch(c['color'])} {c['color']} (already at default)")
        else:
            print(
                f"  {i}. {c['name']} - current: {color_swatch(c['color'])} {c['color']}, "
                f"default: {color_swatch(c['defaultColor'])} {c['defaultColor']}"
            )
    print(f"  A. Reset ALL categories to their defaults")
    print()

    while True:
        choice = input("Category to reset (number, A for all, or blank to cancel): ").strip()
        if not choice:
            return None
        if choice.lower() == "a":
            return ALL
        if not choice.isdigit() or not (1 <= int(choice) <= len(categories)):
            print(f"Enter a number from 1 to {len(categories)}, or A.\n")
            continue
        return categories[int(choice) - 1]


def reset_all_colors(token, categories):
    """Bulk path: resets every category whose `color` has drifted from
    its `defaultColor`. One confirmation up front for the whole batch
    (listing exactly what will change), rather than one confirm per
    category - the per-category path already covers the "decide one
    at a time" case, this one is specifically for "yes, all of them,
    go." Categories already at default are skipped without an API
    call - nothing to change, nothing to confirm.

    A failure resetting one category does NOT stop the rest from being
    attempted - every category gets a try, and the summary at the end
    reports successes and failures separately rather than aborting
    partway through and leaving it unclear what did or didn't happen."""
    to_reset = [c for c in categories if c["color"] != c["defaultColor"]]

    if not to_reset:
        print("\nEvery category is already at its default colour - nothing to do.\n")
        return

    print(f"\nThis will reset {len(to_reset)} categor{'y' if len(to_reset) == 1 else 'ies'}:")
    for c in to_reset:
        print(f'  {c["name"]} - {color_swatch(c["color"])} {c["color"]} -> {color_swatch(c["defaultColor"])} {c["defaultColor"]}')
    print()

    confirm = input(f"Reset all {len(to_reset)} listed above? (y/n): ").strip().lower()
    if confirm != "y":
        print("Cancelled.\n")
        return

    succeeded = []
    failed = []
    for c in to_reset:
        try:
            set_color(token, c["name"], c["defaultColor"])
            succeeded.append(c["name"])
        except Exception as e:
            failed.append((c["name"], str(e)))

    print()
    if succeeded:
        print(f"Reset {len(succeeded)} categor{'y' if len(succeeded) == 1 else 'ies'} to default: {', '.join(succeeded)}")
    if failed:
        print(f"Failed to reset {len(failed)}:")
        for name, err in failed:
            print(f"  {name}: {err}")
    print()


def run_reset_color(token):
    """The actual reset-to-default workflow, assuming `token` is
    already an authenticated admin session. No login prompt in here -
    see run_rename() in renameCategoryAdmin.py for the same pattern."""
    while True:
        try:
            categories = fetch_categories_full(token)
        except Exception as e:
            print(f"Couldn't fetch categories: {e}\n")
            break

        chosen = choose_category_to_reset(categories)
        if chosen is None:
            print("Cancelled.")
            break

        if chosen == ALL:
            reset_all_colors(token, categories)
            again = input("Do something else? (y/n): ").strip().lower()
            if again != "y":
                print("Done.")
                break
            continue

        if chosen["color"] == chosen["defaultColor"]:
            print(f'\n"{chosen["name"]}" is already at its default colour ({color_swatch(chosen["defaultColor"])} {chosen["defaultColor"]}) - nothing to do.\n')
            again = input("Reset another? (y/n): ").strip().lower()
            if again != "y":
                print("Done.")
                break
            continue

        print(
            f'\nReset "{chosen["name"]}" from {color_swatch(chosen["color"])} {chosen["color"]} '
            f'back to its default, {color_swatch(chosen["defaultColor"])} {chosen["defaultColor"]}?'
        )
        confirm = input("Reset this colour? (y/n): ").strip().lower()
        if confirm != "y":
            print("Skipped.\n")
        else:
            try:
                result = set_color(token, chosen["name"], chosen["defaultColor"])
                print(f'Done - "{result["name"]}" is back to {color_swatch(chosen["defaultColor"])} {chosen["defaultColor"]}.\n')
            except Exception as e:
                print(f"Reset failed: {e}\n")

        again = input("Reset another? (y/n): ").strip().lower()
        if again != "y":
            print("Done.")
            break


def main():
    print("Cashflow reset-colour-to-default tool")
    print(f"Backend: {BASE_URL}\n")

    token = admin_login_prompt()
    if token is None:
        return

    run_reset_color(token)


if __name__ == "__main__":
    main()
