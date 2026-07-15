"""
rename_category.py

Small admin CLI for renaming categories on the deployed backend, without
having to hand-craft curl commands each time. Logs in once, then loops
asking for an old/new category name pair until you're done.

Usage:
    python rename_category.py

Requires: pip install requests
"""

import getpass
from urllib.parse import quote

import requests

BASE_URL = "https://cashflowbackend-1era.onrender.com"


def login(username, password):
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"username": username, "password": password},
    )
    data = response.json()
    if not response.ok:
        raise RuntimeError(data.get("error", "Login failed"))
    return data["access_token"]


def rename_category(token, old_name, new_name):
    # URL-encode the old name, since category names can contain spaces
    # and commas (e.g. "Households, medicines and stationary") that
    # aren't valid raw characters in a URL path segment.
    encoded_old_name = quote(old_name, safe="")

    response = requests.patch(
        f"{BASE_URL}/categories/{encoded_old_name}",
        headers={"Authorization": f"Bearer {token}"},
        json={"new_name": new_name},
    )
    data = response.json()
    if not response.ok:
        raise RuntimeError(data.get("error", "Rename failed"))
    return data

 
def main():
    print("Cashflow category rename tool")
    print(f"Backend: {BASE_URL}\n")
 
    username = input("Admin username: ").strip()
 
    # Local safety net only - this does NOT restrict who the backend
    # itself will accept. Any valid login still works against the
    # actual PATCH /categories/<name> endpoint; this just stops this
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
        old_name = input("Category to rename (exact current name): ").strip()
        if not old_name:
            print("Old name can't be empty.\n")
            continue
 
        new_name = input("New name: ").strip()
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