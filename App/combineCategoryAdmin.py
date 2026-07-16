"""
combine_category.py

Small admin CLI for combining two or more existing categories into one,
on the deployed backend. Logs in once, then loops: pick how many
categories to combine, pick each one by number from a live list, give
the combined result a name, and it's done - repeat as many times as
you like.

Usage:
    python combine_category.py

Requires: pip install requests
"""

import getpass

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


def combine_categories(token, names, new_name):
    response = requests.patch(
        f"{BASE_URL}/categories/combine",
        headers={"Authorization": f"Bearer {token}"},
        json={"names": names, "new_name": new_name},
    )
    data = response.json()
    if not response.ok:
        raise RuntimeError(data.get("error", "Combine failed"))
    return data


def print_numbered(categories):
    print()
    for i, name in enumerate(categories, start=1):
        print(f"  {i}. {name}")
    print()


def choose_how_many(max_available):
    while True:
        choice = input(
            f"How many categories do you want to combine? (2-{max_available}): "
        ).strip()
        if not choice.isdigit():
            print("Enter a number.\n")
            continue
        n = int(choice)
        if not (2 <= n <= max_available):
            print(f"Enter a number from 2 to {max_available}.\n")
            continue
        return n


def choose_categories(categories, count):
    """Prompts for `count` distinct categories, one at a time, showing
    only the ones not already picked so you can't select the same one
    twice by accident. Returns the list of chosen names in the order
    picked."""
    remaining = list(categories)
    chosen = []

    for i in range(1, count + 1):
        print_numbered(remaining)
        while True:
            choice = input(f"Category #{i} of {count} (number): ").strip()
            if not choice.isdigit() or not (1 <= int(choice) <= len(remaining)):
                print(f"Enter a number from 1 to {len(remaining)}.\n")
                continue
            break
        picked = remaining.pop(int(choice) - 1)
        chosen.append(picked)

    return chosen


def main():
    print("Cashflow category combine tool")
    print(f"Backend: {BASE_URL}\n")

    username = input("Admin username: ").strip()

    # Same local-only safety net as rename_category.py / the backend's
    # own admin check - this just stops THIS script from running
    # against the wrong account by accident.
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

        if len(categories) < 2:
            print("Need at least 2 categories to combine anything.")
            break

        count = choose_how_many(len(categories))
        chosen = choose_categories(categories, count)

        print(f"\nCombining: {', '.join(chosen)}")
        new_name = input(
            'New name for the combined category (or re-type one of the '
            'above to keep that name): '
        ).strip()
        if not new_name:
            print("New name can't be empty.\n")
            continue

        confirm = input(
            f'Combine {len(chosen)} categories into "{new_name}"? This '
            f'cannot be undone. (y/n): '
        ).strip().lower()
        if confirm != "y":
            print("Cancelled.\n")
            continue

        try:
            result = combine_categories(token, chosen, new_name)
            merged_from = ", ".join(result.get("merged_from", []))
            print(f'Done - combined into "{result["name"]}" (folded in: {merged_from}).\n')
        except Exception as e:
            print(f"Combine failed: {e}\n")

        again = input("Combine another set? (y/n): ").strip().lower()
        if again != "y":
            print("Done.")
            break


if __name__ == "__main__":
    main()