"""
listCategoriesAdmin.py

Read-only: prints every category currently in the `categories` table,
numbered, in display order, along with its colour swatch/hex (and
default colour, if it's been recoloured away from that). Makes no
changes - nothing else to it. Meant for quick reference (e.g. when you
need the exact current list of names AND colours to sync a schema
change against) rather than any of the mutating tools.

Usage:
    python listCategoriesAdmin.py

Requires: pip install requests

Can also be used from categoryAdminCli.py (the combined menu tool) via
run_list(token).
"""

from adminCliCommon import BASE_URL, fetch_categories_full, color_swatch, admin_login_prompt


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
        default_note = "" if c["color"] == c["defaultColor"] else f" (default: {color_swatch(c['defaultColor'])} {c['defaultColor']})"
        print(f"  {i}. {color_swatch(c['color'])} {c['name']} - {c['color']}{default_note}")
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
