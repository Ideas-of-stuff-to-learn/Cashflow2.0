"""
rename_category.py

Small admin CLI for renaming categories on the deployed backend, without
having to hand-craft curl commands each time. Logs in once, then loops
asking which category to rename (picked by number from a live list) and
what to rename it to, until you're done.

Usage:
    python rename_category.py

Requires: pip install requests
"""

import getpass

import requests

# Was pointing at "cashflowbackend-1era.onrender.com" - an old/different
# Render service than what the app actually talks to (see BASE_URL in
# App/api.js). Fixed to match the real, current backend.
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


def rename_category(token, old_name, new_name):
    # current_name travels in the request BODY now, not the URL path -
    # some category names contain a literal "/" (e.g. "Sports/Fitness"),
    # and a URL-encoded slash (%2F) is handled specially by a lot of web
    # infrastructure for security reasons, which meant it could get
    # rejected or mismatched before Flask's own routing ever saw it -
    # regardless of URL-encoding it correctly on this end. Request
    # bodies have no such restriction on any character.
    response = requests.patch(
        f"{BASE_URL}/categories",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_name": old_name, "new_name": new_name},
    )
    data = response.json()
    if not response.ok:
        raise RuntimeError(data.get("error", "Rename failed"))
    return data


def choose_category(categories, prompt="Category to rename"):
    """Prints a numbered list and returns the chosen name, or None if
    the user backs out (blank input)."""
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


def main():
    print("Cashflow category rename tool")
    print(f"Backend: {BASE_URL}\n")

    username = input("Admin username: ").strip()

    # Local safety net only - this does NOT restrict who the backend
    # itself will accept. Any valid login still works against the
    # actual PATCH /categories endpoint; this just stops this
    # particular script from running against the wrong account by
    # accident (e.g. a typo, or muscle-memory logging into a test user).
    if username != "admin":
        print("This tool is restricted to the admin account.")
        return

    password = getpass.getpass("Admin password: ")

    try:
        token = login(username, password)
    except Exception as e:
        print(f"Login failed: {e}")
        return

    print("Logged in.\n")

    while True:
        try:
            categories = fetch_categories(token)
        except Exception as e:
            print(f"Couldn't fetch categories: {e}\n")
            break

        old_name = choose_category(categories, "Category to rename")
        if old_name is None:
            print("Cancelled.")
            break

        new_name = input(f'New name for "{old_name}": ').strip()
        if not new_name:
            print("New name can't be empty.\n")
            continue

        try:
            result = rename_category(token, old_name, new_name)
            print(f"Done - renamed to \"{result['name']}\".\n")
        except Exception as e:
            print(f"Rename failed: {e}\n")

        again = input("Rename another? (y/n): ").strip().lower()
        if again != "y":
            print("Done.")
            break


if __name__ == "__main__":
    main()