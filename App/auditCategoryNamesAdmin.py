"""
audit_category_names.py

Read-only diagnostic: compares the category names in the `categories`
table against the distinct category strings actually appearing on your
transactions (via /charts/summary and /transactions), and flags any
category that LOOKS the same but isn't an exact string match anywhere
- e.g. trailing whitespace, a smart-quote vs straight quote, a stray
double space, different capitalisation.

Makes no changes. Safe to run any time.

Usage:
    python audit_category_names.py

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


def fetch_summary_categories(token):
    response = requests.get(
        f"{BASE_URL}/charts/summary",
        headers={"Authorization": f"Bearer {token}"},
    )
    data = response.json()
    if not response.ok:
        raise RuntimeError(data.get("error", "Failed to fetch chart summary"))
    names = set()
    for row in data.get("yearly", []):
        names.add(row["category"])
    for row in data.get("monthly", []):
        names.add(row["category"])
    return names


def fetch_transaction_categories(token):
    response = requests.get(
        f"{BASE_URL}/transactions",
        headers={"Authorization": f"Bearer {token}"},
    )
    data = response.json()
    if not response.ok:
        raise RuntimeError(data.get("error", "Failed to fetch transactions"))
    return {t["category"] for t in data["transactions"] if t.get("category")}


def main():
    print("Cashflow category name audit (read-only)")
    print(f"Backend: {BASE_URL}\n")

    username = input("Admin username: ").strip()
    password = getpass.getpass("Password: ")

    try:
        token = login(username, password)
    except Exception as e:
        print(f"Login failed: {e}")
        return

    print("Logged in.\n")

    try:
        category_names = fetch_categories(token)
        summary_names = fetch_summary_categories(token)
        txn_names = fetch_transaction_categories(token)
    except Exception as e:
        print(f"Failed to fetch data: {e}")
        return

    print(f"{len(category_names)} categories in the categories table.")
    print(f"{len(summary_names)} distinct category strings in /charts/summary.")
    print(f"{len(txn_names)} distinct category strings in /transactions.\n")

    category_set = set(category_names)

    # Categories that exist in the categories table but never appear on
    # ANY transaction summary row - either genuinely unused, or a
    # string mismatch is hiding its real transactions under a
    # different-looking key.
    in_categories_not_in_summary = category_set - summary_names
    # The reverse: strings appearing on transactions/summary that
    # aren't an exact match for anything in the categories table at
    # all - these are the ones to look at closely.
    in_summary_not_in_categories = summary_names - category_set
    in_txns_not_in_categories = txn_names - category_set

    if in_categories_not_in_summary:
        print("In `categories` table but no matching transactions (may just be unused, or may be the mismatch):")
        for name in sorted(in_categories_not_in_summary):
            print(f"  {name!r}")
        print()

    if in_summary_not_in_categories:
        print("⚠️  Appears in /charts/summary but has NO exact match in `categories` table:")
        for name in sorted(in_summary_not_in_categories):
            print(f"  {name!r}")
        print()

    if in_txns_not_in_categories:
        print("⚠️  Appears in /transactions but has NO exact match in `categories` table:")
        for name in sorted(in_txns_not_in_categories):
            print(f"  {name!r}")
        print()

    if not (in_categories_not_in_summary or in_summary_not_in_categories or in_txns_not_in_categories):
        print("No mismatches found - every category name lines up exactly everywhere checked.")
    else:
        print("Tip: the repr() output above shows exact characters, including any invisible")
        print("whitespace - compare the flagged strings closely against each other and against")
        print("what you typed into the combine/rename tool.")


if __name__ == "__main__":
    main()