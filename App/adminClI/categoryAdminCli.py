"""
categoryAdminCli.py

Combined admin CLI - logs in ONCE, then shows a numbered menu of every
category action (add, rename, combine, delete, audit) and runs
whichever one you pick, looping back to the menu when it's done so you
can do several different kinds of action in one session without
re-entering your password each time.

This does NOT reimplement any of the actions - it imports and calls
run_add(), run_rename(), run_combine(), run_delete(), run_audit(),
run_list(), run_set_color(), run_set_default_color(),
run_set_color_and_default(), run_reset_color(), run_list_users(),
run_assign_role(), run_manage_permissions(), and run_manage_roles()
from the individual scripts (addCategoryAdmin.py, renameCategoryAdmin.py,
combineCategoryAdmin.py, deleteCategoryAdmin.py,
auditCategoryNamesAdmin.py, listCategoriesAdmin.py, setColorAdmin.py,
setDefaultColorAdmin.py, setColorAndDefaultAdmin.py, resetColorAdmin.py,
listUsersAdmin.py, assignRoleAdmin.py, managePermissionsAdmin.py,
manageRolesAdmin.py). Those scripts still work standalone too
(`python renameCategoryAdmin.py` etc still does exactly what it always
did) - this is just another way to reach the same logic, sharing one
login instead of fourteen.

The login itself no longer requires the literal username "admin" - see
adminCliCommon.py's admin_login_prompt(), which now checks the real
permission system (any account with SOME elevated access gets in; a
plain 'user' with nothing does not). Every individual action below
still enforces its own specific permission server-side regardless of
what this menu shows or lets you attempt.

Usage:
    python categoryAdminCli.py

Requires: pip install requests

All fourteen action scripts, plus adminCliCommon.py, need to be in the
same folder as this file for the imports below to work.
"""

from adminCliCommon import BASE_URL, admin_login_prompt
from addCategoryAdmin import run_add
from renameCategoryAdmin import run_rename
from combineCategoryAdmin import run_combine
from deleteCategoryAdmin import run_delete
from auditCategoryNamesAdmin import run_audit
from listCategoriesAdmin import run_list
from setColorAdmin import run_set_color
from setDefaultColorAdmin import run_set_default_color
from setColorAndDefaultAdmin import run_set_color_and_default
from resetColorAdmin import run_reset_color
from listUsersAdmin import run_list_users
from assignRoleAdmin import run_assign_role
from managePermissionsAdmin import run_manage_permissions
from manageRolesAdmin import run_manage_roles

MENU = [
    ("Add a category", run_add),
    ("Rename a category", run_rename),
    ("Combine categories", run_combine),
    ("Delete a category", run_delete),
    ("Audit category names (read-only)", run_audit),
    ("List categories, numbered (read-only)", run_list),
    ("Change a category's colour (default unaffected)", run_set_color),
    ("Change a category's default colour (current unaffected)", run_set_default_color),
    ("Change a category's colour, with option to update default too", run_set_color_and_default),
    ("Reset a category's colour back to its default", run_reset_color),
    ("List users and their roles/permissions (read-only)", run_list_users),
    ("Assign a role to a user", run_assign_role),
    ("Grant/revoke an individual permission for one user", run_manage_permissions),
    ("Create, edit, or delete roles", run_manage_roles),
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
