"""
adminCliCommon.py

Shared helpers for the Cashflow category admin CLI tools - login,
fetching the category list, and the standard "pick one from a numbered
list" prompt. Every admin*.py script imports these instead of keeping
its own copy, so there's exactly one implementation of each to
maintain (previously login() and fetch_categories() were duplicated,
identically, in every single one of these scripts).

Not a script itself - nothing here has a __main__ block, it's only
meant to be imported.
"""

import requests

BASE_URL = "https://cashflow2-0.onrender.com"


def login(username, password):
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"username": username, "password": password},
    )
    data = response.json()
    if not response.ok:
        raise RuntimeError(data.get("error", "Login failed"))
    return data["access_token"]


def fetch_categories(token):
    response = requests.get(
        f"{BASE_URL}/categories",
        headers={"Authorization": f"Bearer {token}"},
    )
    data = response.json()
    if not response.ok:
        raise RuntimeError(data.get("error", "Failed to fetch categories"))
    return [c["name"] for c in data["categories"]]


def choose_category(categories, prompt="Category"):
    """Prints a numbered list and returns the chosen name, or None if
    the user backs out (blank input). Used anywhere a script needs to
    pick exactly ONE category by number - rename and delete both use
    this as-is; combine has its own choose_categories() (plural, picks
    several distinct ones) since that's a different shape of prompt."""
    print()
    for i, name in enumerate(categories, start=1):
        print(f"  {i}. {name}")
    print()

    while True:
        choice = input(f"{prompt} (number, or blank to cancel): ").strip()
        if not choice:
            return None
        if not choice.isdigit() or not (1 <= int(choice) <= len(categories)):
            print(f"Enter a number from 1 to {len(categories)}.\n")
            continue
        return categories[int(choice) - 1]


def admin_login_prompt():
    """Standard login prompt used by every script's standalone
    __main__ entry point - asks for username/password, enforces the
    "admin" username restriction, logs in, and returns the token (or
    None if login didn't happen, in which case the caller should just
    return without doing anything further)."""
    username = input("Admin username: ").strip()

    # Local safety net only - this does NOT restrict who the backend
    # itself will accept. Any valid login still works against the
    # actual endpoints; this just stops these scripts from running
    # against the wrong account by accident.
    if username != "admin":
        print("This tool is restricted to the admin account.")
        return None

    import getpass
    password = getpass.getpass("Admin password: ")

    try:
        token = login(username, password)
    except Exception as e:
        print(f"Login failed: {e}")
        return None

    print("Logged in.\n")
    return token
