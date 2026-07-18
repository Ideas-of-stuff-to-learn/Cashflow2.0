"""
reorderCategoriesAdmin.py

Sets the global display_order of categories in the database — the order
all users see by default when they open the charts screen (bottom segment
= first in list, top segment = last). This is a global change: it takes
effect immediately for every user, on every device, on their next app
open or refresh.

Individual users can override this order locally on their own device via
the "Stack order" panel in the app (see useStackOrder.js / AsyncStorage).
This CLI sets the GLOBAL DEFAULT that local preferences are compared
against and that fresh installs start from.

Validation is strict: the backend rejects any request where the list
doesn't contain every existing category exactly once. This script only
allows confirmed, valid reorders to be submitted.

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
    The backend validates that every existing category is present
    exactly once before writing anything - raises RuntimeError (via
    check_response) if not."""
    response = requests.patch(
        f"{BASE_URL}/categories/order",
        headers={"Authorization": f"Bearer {token}"},
        json={"names": names},
    )
    return check_response(response, "Reorder failed")


def print_order(names):
    print()
    for i, name in enumerate(names, start=1):
        marker = "▼ bottom" if i == 1 else ("▲ top   " if i == len(names) else "        ")
        print(f"  {i:>2}. {marker}  {name}")
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

    # Work on a mutable copy - the original is untouched until the user
    # explicitly confirms and submits.
    order = list(category_names)

    print("Current order (top of list = bottom of stacked bar):")
    print_order(order)

    while True:
        print("  U <n>  — move item n UP one position (towards bottom of bar)")
        print("  D <n>  — move item n DOWN one position (towards top of bar)")
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
            order = list(category_names)
            print("\nReset to original order:")
            print_order(order)
            continue

        if cmd in ('U', 'D'):
            if len(parts) < 2 or not parts[1].isdigit():
                print(f"Usage: {cmd} <number>\n")
                continue
            n = int(parts[1])
            if not (1 <= n <= len(order)):
                print(f"Enter a number from 1 to {len(order)}.\n")
                continue
            idx = n - 1
            if cmd == 'U':
                if idx == 0:
                    print("Already at the top of the list.\n")
                    continue
                order[idx - 1], order[idx] = order[idx], order[idx - 1]
            else:
                if idx == len(order) - 1:
                    print("Already at the bottom of the list.\n")
                    continue
                order[idx], order[idx + 1] = order[idx + 1], order[idx]
            print_order(order)
            continue

        if cmd == 'S':
            if order == list(category_names):
                print("Order hasn't changed - nothing to submit.\n")
                continue
            print("Submit this order to the database? This becomes the global default for all users.")
            print_order(order)
            confirm = input("Confirm? (y/n): ").strip().lower()
            if confirm != 'y':
                print("Cancelled.\n")
                continue
            try:
                result = reorder_categories(token, order)
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
