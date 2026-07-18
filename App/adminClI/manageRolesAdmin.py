"""
manageRolesAdmin.py

Creates, edits, and deletes ROLES - the reusable named bundles of
permissions (as opposed to managePermissionsAdmin.py, which changes one
individual person's access without touching any role at all). Use this
when you want a whole new tier that multiple people could be assigned
to (e.g. a "Support" role that can recolour categories but nothing
else), not just a one-off exception for a single person.

The three built-in roles (owner/admin/user) can have their LEVEL
changed here, but not their name, and they can't be deleted - see
PROTECTED_ROLE_NAMES in permissions.py. Editing their permission
bundle IS allowed (e.g. deciding admin should also get
categories.combine by default) - it's specifically renaming/deleting
the three foundational tiers that's refused, both here and server-side.

Hierarchy guard (also enforced server-side): a new or edited role's
level must be strictly below your own, unless you're the owner. Same
reasoning as assignRoleAdmin.py's guard - otherwise a single
roles.manage grant would let someone mint a role as powerful as
themselves.

Usage:
    python manageRolesAdmin.py

Requires: pip install requests

Can also be used from categoryAdminCli.py (the combined menu tool) via
run_manage_roles(token).
"""

import requests

from adminCliCommon import (
    BASE_URL, fetch_me, fetch_roles, fetch_permissions,
    choose_from_list, choose_multiple_permissions, admin_login_prompt,check_response
)

PROTECTED_ROLE_NAMES = {"owner", "admin", "user"}


def create_role(token, name, level, permission_keys):
    response = requests.post(
        f"{BASE_URL}/admin/roles",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": name, "level": level, "permissions": sorted(permission_keys)},
    )
    data = check_response(response, "Role creation failed")
    return data["role"]


def update_role(token, role_id, level=None, permission_keys=None):
    body = {}
    if level is not None:
        body["level"] = level
    if permission_keys is not None:
        body["permissions"] = sorted(permission_keys)
    response = requests.patch(
        f"{BASE_URL}/admin/roles/{role_id}",
        headers={"Authorization": f"Bearer {token}"},
        json=body,
    )
    data = check_response(response, "Role update failed")
    return data["role"]


def delete_role(token, role_id):
    response = requests.delete(
        f"{BASE_URL}/admin/roles/{role_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    data = check_response(response, "Role deletion failed")
    return data


def _do_create(token, me, all_permissions):
    name = input("New role name: ").strip()
    if not name:
        print("Cancelled.\n")
        return
    if name in PROTECTED_ROLE_NAMES:
        print(f'"{name}" is a reserved role name.\n')
        return

    level_str = input(f"Level (integer, must be below your own level {me['level']} unless you're owner): ").strip()
    if not level_str.lstrip('-').isdigit():
        print("Level must be an integer.\n")
        return
    level = int(level_str)

    permission_keys = choose_multiple_permissions(all_permissions)

    print(f'\nCreate role "{name}" (level {level}) with permissions: {", ".join(sorted(permission_keys)) or "(none)"}')
    if input("Confirm? (y/n): ").strip().lower() != "y":
        print("Cancelled.\n")
        return

    try:
        role = create_role(token, name, level, permission_keys)
        print(f'Done - role "{role["name"]}" created.\n')
    except Exception as e:
        print(f"Creation failed: {e}\n")


def _do_edit(token, me, roles, all_permissions):
    chosen = choose_from_list(
        roles,
        lambda r: f'{r["name"]} (level {r["level"]}) - {", ".join(r["permissions"]) or "(no permissions)"}',
        prompt="Role to edit",
    )
    if chosen is None:
        print("Cancelled.")
        return

    print("\n  1. Change level")
    print("  2. Change permission bundle")
    print("  3. Both")
    print("  4. Cancel")
    action = input("What to edit (number): ").strip()
    if action not in ("1", "2", "3"):
        print("Cancelled.\n")
        return

    new_level = None
    new_permissions = None

    if action in ("1", "3"):
        level_str = input(f"New level (currently {chosen['level']}): ").strip()
        if level_str.lstrip('-').isdigit():
            new_level = int(level_str)
        else:
            print("Level must be an integer - level left unchanged.\n")

    if action in ("2", "3"):
        new_permissions = choose_multiple_permissions(all_permissions, preselected=chosen["permissions"])

    try:
        result = update_role(token, chosen["id"], level=new_level, permission_keys=new_permissions)
        print(f'Done - "{result["name"]}" is now level {result["level"]} with permissions: {", ".join(result["permissions"]) or "(none)"}\n')
    except Exception as e:
        print(f"Update failed: {e}\n")


def _do_delete(token, roles):
    deletable = [r for r in roles if r["name"] not in PROTECTED_ROLE_NAMES]
    if not deletable:
        print("\nNo custom roles to delete - owner/admin/user are protected.\n")
        return

    chosen = choose_from_list(
        deletable,
        lambda r: f'{r["name"]} (level {r["level"]})',
        prompt="Role to delete",
    )
    if chosen is None:
        print("Cancelled.")
        return

    print(f'\nDelete role "{chosen["name"]}"? This fails if any user still has it.')
    if input("Confirm? (y/n): ").strip().lower() != "y":
        print("Cancelled.\n")
        return

    try:
        delete_role(token, chosen["id"])
        print(f'Done - "{chosen["name"]}" deleted.\n')
    except Exception as e:
        print(f"Deletion failed: {e}\n")


def run_manage_roles(token):
    """The actual role-management workflow, assuming `token` is already
    an authenticated session. No re-login prompt in here - see
    run_rename() in renameCategoryAdmin.py for the same pattern."""
    try:
        me = fetch_me(token)
    except Exception as e:
        print(f"Couldn't fetch your own account info: {e}\n")
        return

    while True:
        try:
            roles = fetch_roles(token)
            all_permissions = fetch_permissions(token)
        except Exception as e:
            print(f"Couldn't fetch roles/permissions: {e}\n")
            break

        print("\n  1. Create a new role")
        print("  2. Edit an existing role (level and/or permissions)")
        print("  3. Delete a custom role")
        print("  4. Quit")
        choice = input("Action (number): ").strip()

        if choice == "1":
            _do_create(token, me, all_permissions)
        elif choice == "2":
            _do_edit(token, me, roles, all_permissions)
        elif choice == "3":
            _do_delete(token, roles)
        else:
            print("Done.")
            break


def main():
    print("Cashflow manage-roles tool")
    print(f"Backend: {BASE_URL}\n")

    token = admin_login_prompt()
    if token is None:
        return

    run_manage_roles(token)


if __name__ == "__main__":
    main()
