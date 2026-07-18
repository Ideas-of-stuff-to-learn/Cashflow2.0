"""
managePermissionsAdmin.py

Fine-grained, per-PERSON permission tool - grants or revokes one
specific permission for one specific user, on top of whatever their
role already gives them, without changing their role or creating a new
one just for this. This is the "give this one admin everything except
category deletion" or "let this one plain user rename categories,
nothing else" tool.

Three actions per (user, permission) pair:
- Grant: this user gets this permission even if their role doesn't
  include it.
- Revoke: this user is explicitly denied this permission even if their
  role WOULD normally include it.
- Clear: remove any override, fall back to whatever the role alone
  says.

Usage:
    python managePermissionsAdmin.py

Requires: pip install requests

Can also be used from categoryAdminCli.py (the combined menu tool) via
run_manage_permissions(token).
"""

import requests

from adminCliCommon import BASE_URL, fetch_users, fetch_permissions, choose_from_list, admin_login_prompt,check_response


def set_permission_override(token, user_id, permission_key, granted):
    """granted is True (grant), False (revoke), or None (clear)."""
    response = requests.patch(
        f"{BASE_URL}/admin/users/{user_id}/permissions",
        headers={"Authorization": f"Bearer {token}"},
        json={"permission": permission_key, "granted": granted},
    )
    data = check_response(response, "Permission override failed")
    return data["user"]


def run_manage_permissions(token):
    """The actual override workflow, assuming `token` is already an
    authenticated session. No re-login prompt in here - see
    run_rename() in renameCategoryAdmin.py for the same pattern."""
    while True:
        try:
            users = fetch_users(token)
            all_permissions = fetch_permissions(token)
        except Exception as e:
            print(f"Couldn't fetch users/permissions: {e}\n")
            break

        chosen_user = choose_from_list(
            users,
            lambda u: f'{u["username"]} - {u["role"]} (level {u["level"]}) - has: {", ".join(u["permissions"]) or "(nothing beyond role defaults)"}',
            prompt="User to change permissions for",
        )
        if chosen_user is None:
            print("Cancelled.")
            break

        chosen_perm = choose_from_list(
            all_permissions,
            lambda p: f'{p["key"]} - {p["description"]}'
                      + (' [currently has]' if p["key"] in chosen_user["permissions"] else ''),
            prompt="Permission to change",
        )
        if chosen_perm is None:
            print("Cancelled.")
            break

        currently_has = chosen_perm["key"] in chosen_user["permissions"]
        print(f'\n"{chosen_user["username"]}" currently {"HAS" if currently_has else "does NOT have"} "{chosen_perm["key"]}".')
        print("  1. Grant it (even if their role doesn't include it)")
        print("  2. Revoke it (even if their role would normally include it)")
        print("  3. Clear any override (fall back to whatever their role alone says)")
        print("  4. Cancel")
        action = input("Action (number): ").strip()

        granted_map = {"1": True, "2": False, "3": None}
        if action not in granted_map:
            print("Skipped.\n")
        else:
            granted = granted_map[action]
            try:
                result = set_permission_override(token, chosen_user["id"], chosen_perm["key"], granted)
                now_has = chosen_perm["key"] in result["permissions"]
                print(f'Done - "{result["username"]}" now {"HAS" if now_has else "does NOT have"} "{chosen_perm["key"]}".\n')
            except Exception as e:
                print(f"Update failed: {e}\n")

        again = input("Change another? (y/n): ").strip().lower()
        if again != "y":
            print("Done.")
            break


def main():
    print("Cashflow manage-permissions tool")
    print(f"Backend: {BASE_URL}\n")

    token = admin_login_prompt()
    if token is None:
        return

    run_manage_permissions(token)


if __name__ == "__main__":
    main()
