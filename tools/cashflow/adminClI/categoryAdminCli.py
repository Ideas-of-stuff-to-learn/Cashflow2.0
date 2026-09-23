"""
categoryAdminCli.py

Combined admin CLI - logs in ONCE, then shows a two-level menu: pick a
GROUP first (categories / category colours / permissions / users),
then pick a specific action within that group, then loop back to the
action list (not all the way back to the group picker) so several
actions of the same kind can be done in a row without re-navigating.
Picking "back" from an action list returns to the group picker.

Groups exist purely for navigability now that there are twenty
individual actions - grouping them keeps any single screenful of
options short and organizes them by what kind of thing you're doing,
rather than one long flat list of unrelated-looking items.

This does NOT reimplement any of the actions - it imports and calls
run_add(), run_rename(), run_combine(), run_delete(), run_audit(),
run_list(), run_set_color(), run_set_default_color(),
run_set_color_and_default(), run_reset_color(), run_list_users(),
run_assign_role(), run_manage_permissions(), run_manage_roles(),
run_list_impersonation_log(), run_create_user(), run_delete_user(),
run_edit_user(), run_impersonate_user(), and
run_manage_user_transactions() from the individual scripts
(addCategoryAdmin.py, renameCategoryAdmin.py, combineCategoryAdmin.py,
deleteCategoryAdmin.py, auditCategoryNamesAdmin.py,
listCategoriesAdmin.py, setColorAdmin.py, setDefaultColorAdmin.py,
setColorAndDefaultAdmin.py, resetColorAdmin.py, listUsersAdmin.py,
assignRoleAdmin.py, managePermissionsAdmin.py, manageRolesAdmin.py,
listImpersonationLogAdmin.py, createUserAdmin.py, deleteUserAdmin.py,
editUserAdmin.py, impersonateUserAdmin.py,
manageUserTransactionsAdmin.py). Those scripts still work standalone
too (`python renameCategoryAdmin.py` etc still does exactly what it
always did) - this is just another way to reach the same logic,
sharing one login instead of twenty.

The login itself no longer requires the literal username "admin" - see
adminCliCommon.py's admin_login_prompt(), which now checks the real
permission system (any account with SOME elevated access gets in; a
plain 'user' with nothing does not). Every individual action below
still enforces its own specific permission server-side regardless of
what this menu shows or lets you attempt - grouping is purely
organizational, not a second access-control layer.

If your session expires or gets revoked mid-run (see handoff6.txt for
the token-lifetime work this closes a gap in), this menu notices right
before running your next chosen action and prompts you to log back in,
rather than silently repeating the same failure - see
_session_still_valid() below.

Usage:
    python categoryAdminCli.py

Requires: pip install requests

"""

from .adminCliCommon import BASE_URL, admin_login_prompt, fetch_me, SessionExpired

from .categories.addCategoryAdmin import run_add
from .categories.renameCategoryAdmin import run_rename
from .categories.combineCategoryAdmin import run_combine
from .categories.deleteCategoryAdmin import run_delete
from .categories.auditCategoryNamesAdmin import run_audit
from .categories.listCategoriesAdmin import run_list
from .categories.reorderCategoriesAdmin import run_reorder_categories

from .colours.setColorAdmin import run_set_color
from .colours.setDefaultColorAdmin import run_set_default_color
from .colours.setColorAndDefaultAdmin import run_set_color_and_default
from .colours.resetColorAdmin import run_reset_color

from .users.listUsersAdmin import run_list_users
from .permissions.assignRoleAdmin import run_assign_role
from .permissions.managePermissionsAdmin import run_manage_permissions
from .permissions.manageRolesAdmin import run_manage_roles
from .permissions.listImpersonationLogAdmin import run_list_impersonation_log

from .users.createUserAdmin import run_create_user
from .users.deleteUserAdmin import run_delete_user
from .users.editUserAdmin import run_edit_user
from .users.impersonateUserAdmin import run_impersonate_user
from .users.manageUserTransactionsAdmin import run_manage_user_transactions

# Each group is (label, [(action_label, run_fn), ...]). Order here is
# the order groups/actions are shown in - purely presentational, no
# behavior depends on it.
GROUPS = [
    ("Work with categories", [
        ("Add a category", run_add),
        ("Rename a category", run_rename),
        ("Combine categories", run_combine),
        ("Delete a category", run_delete),
        ("Audit category names (read-only)", run_audit),
        ("List categories, numbered (read-only)", run_list),
        ("Reorder categories (global display order)", run_reorder_categories),
    ]),
    ("Work with category colours", [
        ("Change a category's colour (default unaffected)", run_set_color),
        ("Change a category's default colour (current unaffected)", run_set_default_color),
        ("Change a category's colour, with option to update default too", run_set_color_and_default),
        ("Reset a category's colour back to its default", run_reset_color),
    ]),
    ("Work with permissions", [
        ("List users and their roles/permissions (read-only)", run_list_users),
        ("Assign a role to a user", run_assign_role),
        ("Grant/revoke an individual permission for one user", run_manage_permissions),
        ("Create, edit, or delete roles", run_manage_roles),
        ("View the impersonation audit log (read-only)", run_list_impersonation_log),
    ]),
    ("Work with users", [
        ("Create a new user account", run_create_user),
        ("Delete a user account", run_delete_user),
        ("Edit a user's username/password", run_edit_user),
        ("Log in as a user (impersonate)", run_impersonate_user),
        ("View/filter/delete/recategorise a user's transactions", run_manage_user_transactions),
    ]),
]


def choose_group():
    """Top-level picker - returns the chosen (label, actions) tuple, or
    None on Quit."""
    print()
    for i, (label, _actions) in enumerate(GROUPS, start=1):
        print(f"  {i}. {label}")
    print(f"  {len(GROUPS) + 1}. Quit")
    print()

    while True:
        choice = input("Group (number): ").strip()
        if not choice.isdigit():
            print("Enter a number.\n")
            continue
        n = int(choice)
        if n == len(GROUPS) + 1:
            return None
        if 1 <= n <= len(GROUPS):
            return GROUPS[n - 1]
        print(f"Enter a number from 1 to {len(GROUPS) + 1}.\n")


def choose_action(group_label, actions):
    """Second-level picker within a chosen group - returns the chosen
    (label, run_fn) tuple, or None to go back to the group picker."""
    print(f"\n--- {group_label} ---")
    for i, (label, _fn) in enumerate(actions, start=1):
        print(f"  {i}. {label}")
    print(f"  {len(actions) + 1}. Back to groups")
    print()

    while True:
        choice = input("Action (number): ").strip()
        if not choice.isdigit():
            print("Enter a number.\n")
            continue
        n = int(choice)
        if n == len(actions) + 1:
            return None
        if 1 <= n <= len(actions):
            return actions[n - 1]
        print(f"Enter a number from 1 to {len(actions) + 1}.\n")


def _session_still_valid(token):
    """Lightweight check via /auth/me (no permission gate beyond being
    logged in at all) - specifically distinguishes SessionExpired
    (token dead: expired, revoked, or otherwise no longer valid) from
    any other failure. A generic exception here (network blip, backend
    briefly down) does NOT force a re-login - that would be the wrong
    reaction to a transient problem - only a confirmed SessionExpired
    does. The actual action the user picks still has its own error
    handling for anything else that goes wrong."""
    try:
        fetch_me(token)
        return True
    except SessionExpired:
        return False
    except Exception:
        return True


def main():
    print("Cashflow category admin tool")
    print(f"Backend: {BASE_URL}\n")

    token = admin_login_prompt()
    if token is None:
        return

    while True:
        group = choose_group()
        if group is None:
            print("Bye.")
            break

        group_label, actions = group

        # Stays inside this group's action list until "back to groups"
        # is picked - so several actions of the SAME kind (e.g. adding
        # three categories in a row) don't require re-picking the
        # group each time. Picking a different KIND of action still
        # only costs one extra "back" + one group pick, not a full
        # re-login.
        while True:
            action = choose_action(group_label, actions)
            if action is None:
                break  # back to the group picker

            # Checked HERE, right before running the chosen action,
            # rather than relying on each run_X() to detect and
            # propagate an expired session itself - every run_X()
            # already wraps its own calls in a generic
            # `except Exception`, which would otherwise silently
            # swallow SessionExpired too and just print it as an
            # ordinary failure message, leaving the same dead token in
            # place for every subsequent attempt. Catching it centrally
            # here means one clear message and an actual chance to log
            # back in, instead of a menu that keeps failing the same
            # way until the whole script is restarted by hand.
            if not _session_still_valid(token):
                print("\nYour session has expired or was revoked - please log in again.\n")
                token = admin_login_prompt()
                if token is None:
                    print("Bye.")
                    return
                continue  # re-show this same group's action list with the fresh token

            label, run_fn = action
            print(f"\n--- {label} ---")
            run_fn(token)
            # Falls back to this group's action list here regardless of
            # how the chosen action's own inner loop ended (finished,
            # cancelled, failed) - each run_X() already handles its own
            # "do this again?" looping internally; this loop is only
            # for picking a DIFFERENT action within the same group next.


if __name__ == "__main__":
    main()
