"""
categoryAdminCli.py

Combined admin CLI - logs in ONCE, then shows a numbered menu of every
category action (add, rename, combine, delete, audit) and runs
whichever one you pick, looping back to the menu when it's done so you
can do several different kinds of action in one session without
re-entering your password each time.

This does NOT reimplement any of the actions - it imports and calls
run_add(), run_rename(), run_combine(), run_delete(), run_audit(), and
run_list() from the individual scripts (addCategoryAdmin.py,
renameCategoryAdmin.py, combineCategoryAdmin.py, deleteCategoryAdmin.py,
auditCategoryNamesAdmin.py, listCategoriesAdmin.py). Those scripts
still work standalone too (`python renameCategoryAdmin.py` etc still
does exactly what it always did) - this is just another way to reach
the same logic, sharing one login instead of six.

Usage:
    python categoryAdminCli.py

Requires: pip install requests

All six action scripts, plus adminCliCommon.py, need to be in the
same folder as this file for the imports below to work.
"""

from adminCliCommon import BASE_URL, admin_login_prompt
from addCategoryAdmin import run_add
from renameCategoryAdmin import run_rename
from combineCategoryAdmin import run_combine
from deleteCategoryAdmin import run_delete
from auditCategoryNamesAdmin import run_audit
from listCategoriesAdmin import run_list

MENU = [
    ("Add a category", run_add),
    ("Rename a category", run_rename),
    ("Combine categories", run_combine),
    ("Delete a category", run_delete),
    ("Audit category names (read-only)", run_audit),
    ("List categories, numbered (read-only)", run_list),
]


def choose_action():
    print()
    for i, (label, _) in enumerate(MENU, start=1):
        print(f"  {i}. {label}")
    print(f"  {len(MENU) + 1}. Quit")
    print()

    while True:
        choice = input("Action (number): ").strip()
        if not choice.isdigit():
            print("Enter a number.\n")
            continue
        n = int(choice)
        if n == len(MENU) + 1:
            return None
        if 1 <= n <= len(MENU):
            return MENU[n - 1]
        print(f"Enter a number from 1 to {len(MENU) + 1}.\n")


def main():
    print("Cashflow category admin tool")
    print(f"Backend: {BASE_URL}\n")

    token = admin_login_prompt()
    if token is None:
        return

    while True:
        choice = choose_action()
        if choice is None:
            print("Bye.")
            break

        label, run_fn = choice
        print(f"\n--- {label} ---")
        run_fn(token)
        # Falls back to the action menu here regardless of how the
        # chosen action's own inner loop ended (finished, cancelled,
        # failed) - each run_X() already handles its own "do this
        # again?" looping internally; this outer loop is only for
        # picking a DIFFERENT kind of action next, or quitting.


if __name__ == "__main__":
    main()
