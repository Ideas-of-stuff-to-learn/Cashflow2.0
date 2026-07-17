"""
listCategoriesAdmin.py

Read-only: prints every category currently in the `categories` table,
numbered, in display order, along with its colour (and default colour,
if it's been recoloured away from that). Makes no changes - nothing
else to it. Meant for quick reference (e.g. when you need the exact
current list of names AND colours to sync a schema change against)
rather than any of the mutating tools.

Usage:
    python listCategoriesAdmin.py

Requires: pip install requests

Can also be used from categoryAdminCli.py (the combined menu tool) via
run_list(token).
"""

from adminCliCommon import BASE_URL, admin_login_prompt
import requests


def fetch_categories_full(token):
    """Unlike adminCliCommon.fetch_categories() (name-only, used by the
    numbered pickers everywhere else), this keeps color and
    default_color too - needed here since the whole point of this tool
    is being a complete, accurate reference (e.g. for syncing
    schema.sql's seed data against what's actually live)."""
    response = requests.get(
        f"{BASE_URL}/categories",
        headers={"Authorization": f"Bearer {token}"},
    )
    data = response.json()
    if not response.ok:
        raise RuntimeError(data.get("error", "Failed to fetch categories"))
    return data["categories"]


def run_list(token):
    """The actual list workflow, assuming `token` is already an
    authenticated admin session. Runs once and returns - same as
    run_audit() in auditCategoryNamesAdmin.py, there's nothing to loop
    on for a plain listing."""
    try:
        categories = fetch_categories_full(token)
    except Exception as e:
        print(f"Couldn't fetch categories: {e}")
        return

    print(f"\n{len(categories)} categories, in display order:\n")
    for i, c in enumerate(categories, start=1):
        default_note = "" if c["color"] == c["defaultColor"] else f" (default: {c['defaultColor']})"
        print(f"  {i}. {c['name']} - {c['color']}{default_note}")
    print()


def main():
    print("Cashflow list-categories tool")
    print(f"Backend: {BASE_URL}\n")

    token = admin_login_prompt()
    if token is None:
        return

    run_list(token)


if __name__ == "__main__":
    main()