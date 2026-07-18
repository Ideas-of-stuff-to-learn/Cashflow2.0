"""
reorderCategoriesAdmin.py

Sets the global display_order of categories in the database — the order
all users see by default when they open the charts screen. This is a
global change: it takes effect immediately for every user, on every
device, on their next app open or refresh.

The list is displayed exactly as the bar looks: top of the list = top
of the stacked bar, bottom of the list = bottom of the stacked bar.
U moves a category up the list (and up the bar). D moves it down.

Individual users can override this order locally on their own device
via the "Stack order" panel in the app. This CLI sets the GLOBAL
DEFAULT that fresh installs and users without a local preference start
from.

Requires the 'categories.reorder' permission (bundled into the 'admin'
role by default, and always available to owner).

Usage:
    python reorderCategoriesAdmin.py

Requires: pip install requests

Can also be used from categoryAdminCli.py (the combined menu tool) via
run_reorder_categories(token).
"""

import requests

from adminCliCommon import BASE_URL, fetch_categories, admin_login_prompt, check_response


def reorder_categories(token, names):
    """PATCH /categories/order with the new ordered name list.
    The backend expects index 0 = bottom of bar (display_order 1).
    We store internally that way and only flip for display."""
    response = requests.patch(
        f"{BASE_URL}/categories/order",
        headers={"Authorization": f"Bearer {token}"},
        json={"names": names},
    )
    return check_response(response, "Reorder failed")


def print_order(order):
    """Display the order as the bar looks: top of list = top of bar.
    `order` is the internal list (index 0 = bottom of bar), so we
    display it reversed."""
    print()
    n = len(order)
    for display_pos, name in enumerate(reversed(order), start=1):
        if display_pos == 1:
            marker = "▲ top   "
        elif display_pos == n:
            marker = "▼ bottom"
        else:
            marker = "        "
        print(f"  {display_pos:>2}. {marker}  {name}")
    print()


def run_reorder_categories(token):
    """The actual reorder workflow, assuming `token` is already an
    authenticated session. No re-login prompt in here - see
    run_rename() in renameCategoryAdmin.py for the same pattern."""
    try:
        category_names = fetch_categories(token)
    except Exception as e:
        print(f"Couldn't fetch categories: {e}\n")
        return

    # Split Income out - it's shown as a line overlay, not a bar segment,
    # so it shouldn't appear in the reorder list. We remember its original
    # position and stitch it back in before submitting to the backend so
    # its display_order in the DB isn't touched.
    income_index = category_names.index('Income') if 'Income' in category_names else None
    stackable = [c for c in category_names if c != 'Income']

    # Internal order: index 0 = bottom of bar, last index = top of bar.
    # Display order (what the user sees and types numbers against) is the
    # reverse: display position 1 = top of bar = last item internally.
    order = list(stackable)

    print("Current stack order (top of list = top of bar, Income excluded):")
    print_order(order)

    while True:
        print("  U <n>  — move item n up   (higher in the bar)")
        print("  D <n>  — move item n down (lower in the bar)")
        print("  S      — submit this order to the database")
        print("  R      — reset to original order (does not write to DB)")
        print("  Q      — quit without saving")
        print()

        raw = input("Command: ").strip()
        if not raw:
            continue

        parts = raw.split()
        cmd = parts[0].upper()

        if cmd == 'Q':
            print("Quit - no changes saved.")
            break

        if cmd == 'R':
            order = list(stackable)
            print("\nReset to original order:")
            print_order(order)
            continue

        if cmd in ('U', 'D'):
            if len(parts) < 2 or not parts[1].isdigit():
                print(f"Usage: {cmd} <number>\n")
                continue

            display_n = int(parts[1])
            if not (1 <= display_n <= len(order)):
                print(f"Enter a number from 1 to {len(order)} (Income excluded).\n")
                continue

            # Convert display position to internal index.
            # Display pos 1 = top of bar = internal index len-1.
            # Display pos n = bottom of bar = internal index 0.
            idx = len(order) - display_n

            if cmd == 'U':
                # Moving up the display = moving toward higher internal index
                if idx == len(order) - 1:
                    print("Already at the top.\n")
                    continue
                order[idx], order[idx + 1] = order[idx + 1], order[idx]
            else:
                # Moving down the display = moving toward lower internal index
                if idx == 0:
                    print("Already at the bottom.\n")
                    continue
                order[idx - 1], order[idx] = order[idx], order[idx - 1]

            print_order(order)
            continue

        if cmd == 'S':
            if order == list(stackable):
                print("Order hasn't changed - nothing to submit.\n")
                continue
            print("Submit this order to the database? This becomes the global default for all users.")
            print_order(order)
            confirm = input("Confirm? (y/n): ").strip().lower()
            if confirm != 'y':
                print("Cancelled.\n")
                continue
            try:
                # Stitch Income back in at its original position before
                # submitting - we never touched it, just kept it aside.
                submit_order = list(order)
                if income_index is not None:
                    submit_order.insert(income_index, 'Income')
                result = reorder_categories(token, submit_order)
                returned = [c['name'] for c in result['categories']]
                print(f"\nDone — new global order saved ({len(returned)} categories).")
                print_order(returned)
            except Exception as e:
                print(f"Submit failed: {e}\n")
            break

        print(f"Unknown command '{raw}'. Use U <n>, D <n>, S, R, or Q.\n")


def main():
    print("Cashflow category reorder tool")
    print(f"Backend: {BASE_URL}\n")
    print("Changes the GLOBAL default display order — affects all users.\n")

    token = admin_login_prompt()
    if token is None:
        return

    run_reorder_categories(token)


if __name__ == "__main__":
    main()