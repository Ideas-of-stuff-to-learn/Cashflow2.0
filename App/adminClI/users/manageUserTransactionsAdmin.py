"""
manageUserTransactionsAdmin.py

Once you've picked a user (requires being allowed to impersonate them -
same level-ceiling guard as impersonateUserAdmin.py, owner always
exempt), this lets you do most of what THEY could do in the app itself
to their own transaction data: view, filter by category and/or date
range, see a grouped-by-category summary of whatever's currently
filtered, delete transactions (either the whole filtered set or specific
ones you pick), and set a transaction's category (which, same as the
app itself, is a single action whether you're resolving something sat
at "needs manual review" or changing an already-categorised
transaction to something else - see resolve_categories() in
adminCliCommon.py for why those are the same backend call).

No new backend endpoints exist for any of this - it's built entirely
on top of the SAME endpoints the app itself uses (GET/DELETE
/transactions, POST /categorize/resolve), just called with an
impersonated token instead of your own. Whatever those endpoints
already enforce (e.g. a resolve being scoped to the token's own
user_id) applies exactly the same way here.

Impersonation tokens are short-lived (15 minutes - see
IMPERSONATION_TOKEN_EXPIRES in backend.py), which a genuine review
session can easily outlast. Rather than the whole session dying
mid-task, this renews itself transparently: any call using the
impersonated token that comes back with SessionExpired triggers a
silent re-impersonation (using your OWN still-good token and the same
target user id, already in scope) and one retry - you'll see a short
note that it happened, but you won't need to restart anything.

Requires the 'users.impersonate' permission to pick a user at all
(bundled into the 'admin' role by default, and always available to
owner) - obtaining a session for someone is the actual gate; once
you're acting as them, you're bounded by whatever THEIR account itself
is allowed to do (delete/recategorise are personal, unrestricted
actions for any account), same as if they were sitting at their own
device.

Usage:
    python manageUserTransactionsAdmin.py

Requires: pip install requests

Can also be used from categoryAdminCli.py (the combined menu tool) via
run_manage_user_transactions(token).
"""

from ..adminCliCommon import (
    BASE_URL, fetch_me, fetch_users, fetch_categories_full,
    fetch_transactions, delete_transactions, resolve_categories,
    choose_from_list, admin_login_prompt, SessionExpired, revoke_token,
)
from .impersonateUserAdmin import impersonate_user


def _parse_date(d):
    """Parses 'DD/MM/YYYY' into a sortable (year, month, day) tuple, or
    None if it doesn't look like that shape. txn_date is stored as
    free-form bank-export text, not a real date column (see
    backend.py's own comments on this), so this has to tolerate
    anything rather than assume every row is well-formed - mirrors
    ContentsScreen.js's own date parsing for display sorting."""
    if not d:
        return None
    parts = d.split('/')
    if len(parts) != 3:
        return None
    dd, mm, yyyy = parts
    try:
        return (int(yyyy), int(mm), int(dd))
    except ValueError:
        return None


def _apply_filters(transactions, category_filter, date_from, date_to):
    rows = transactions
    if category_filter:
        rows = [t for t in rows if t["category"] in category_filter]
    if date_from:
        from_key = _parse_date(date_from)
        rows = [t for t in rows if _parse_date(t["date"]) and _parse_date(t["date"]) >= from_key]
    if date_to:
        to_key = _parse_date(date_to)
        rows = [t for t in rows if _parse_date(t["date"]) and _parse_date(t["date"]) <= to_key]
    return rows


def _print_transactions(rows):
    if not rows:
        print("\n(no transactions match the current filter)\n")
        return
    print()
    for i, t in enumerate(rows, start=1):
        cat = t["category"] or "(pending)"
        print(f'  {i:>4}. {t["date"]}  £{t["amount"]:>10.2f}  {cat:<40}  {t["description"]}')
    print()


def _pick_category_filter(category_names, current):
    """Toggle-checklist for the category filter - same interaction
    shape as adminCliCommon.choose_multiple_permissions(), specialised
    for plain category name strings instead of permission dicts."""
    selected = set(current)
    while True:
        print("\nFilter by category (toggle by number, A = select all, N = clear filter, blank = done):\n")
        for i, name in enumerate(category_names, start=1):
            mark = "x" if name in selected else " "
            print(f"  [{mark}] {i}. {name}")
        print()

        choice = input("Toggle (number/A/N), or blank to confirm: ").strip()
        if not choice:
            return selected
        if choice.lower() == "a":
            selected = set(category_names)
            continue
        if choice.lower() == "n":
            selected = set()
            continue
        if choice.isdigit() and 1 <= int(choice) <= len(category_names):
            name = category_names[int(choice) - 1]
            if name in selected:
                selected.discard(name)
            else:
                selected.add(name)
            continue
        print(f"Enter a number from 1 to {len(category_names)}, A, N, or blank.\n")


def _pick_date_range(date_from, date_to):
    print(f'\nCurrent range: from {date_from or "(no lower bound)"} to {date_to or "(no upper bound)"}')
    new_from = input('From date (DD/MM/YYYY), blank to clear, or "-" to keep as-is: ').strip()
    new_to = input('To date (DD/MM/YYYY), blank to clear, or "-" to keep as-is: ').strip()

    if new_from == "-":
        pass
    elif new_from == "":
        date_from = None
    elif _parse_date(new_from):
        date_from = new_from
    else:
        print(f'Ignored "{new_from}" - doesn\'t look like DD/MM/YYYY.')

    if new_to == "-":
        pass
    elif new_to == "":
        date_to = None
    elif _parse_date(new_to):
        date_to = new_to
    else:
        print(f'Ignored "{new_to}" - doesn\'t look like DD/MM/YYYY.')

    return date_from, date_to


def _print_grouped_by_category(rows):
    groups = {}
    for t in rows:
        cat = t["category"] or "(pending)"
        g = groups.setdefault(cat, {"count": 0, "total": 0.0})
        g["count"] += 1
        g["total"] += abs(t["amount"] or 0)

    if not groups:
        print("\n(nothing to group - the current filter matches no transactions)\n")
        return

    print()
    for cat, g in sorted(groups.items(), key=lambda kv: -kv[1]["total"]):
        print(f'  {cat:<40} {g["count"]:>4} txns   £{g["total"]:>12.2f}')
    print()


def _pick_specific(rows):
    """Numbered multi-select from a list of transaction rows - toggle
    by number, A/N for all/none, blank confirms. Returns the chosen
    list of transaction dicts (may be empty), or None if genuinely
    cancelled - callers distinguish "picked nothing" from "backed out
    entirely" so an accidental blank confirm doesn't silently act on
    zero rows without at least saying so."""
    selected_idx = set()
    while True:
        print()
        for i, t in enumerate(rows, start=1):
            mark = "x" if i in selected_idx else " "
            cat = t["category"] or "(pending)"
            print(f'  [{mark}] {i:>4}. {t["date"]}  £{t["amount"]:>10.2f}  {cat:<30}  {t["description"]}')
        print()

        choice = input("Toggle (number), A = all, N = none, blank/Enter = confirm selection: ").strip()
        if not choice:
            return [rows[i - 1] for i in sorted(selected_idx)]
        if choice.lower() == "a":
            selected_idx = set(range(1, len(rows) + 1))
            continue
        if choice.lower() == "n":
            selected_idx = set()
            continue
        if choice.isdigit() and 1 <= int(choice) <= len(rows):
            i = int(choice)
            if i in selected_idx:
                selected_idx.discard(i)
            else:
                selected_idx.add(i)
            continue
        print(f"Enter a number from 1 to {len(rows)}, A, N, or blank.\n")


def _call_as_user(session, admin_token, target_user_id, fn, *args, **kwargs):
    """Calls fn(session['token'], *args, **kwargs) - the shared wrapper
    every impersonated-token call in this file goes through. On
    SessionExpired (the impersonation token's 15-minute window ran
    out, or it was revoked from elsewhere), silently re-impersonates
    the SAME target user using the admin's own still-good token, updates
    `session` in place with the new token/jti, and retries the call
    exactly once. A second failure after that retry is a real error,
    not just an expired session, and is left to propagate to the
    caller normally."""
    try:
        return fn(session["token"], *args, **kwargs)
    except SessionExpired:
        print("(That impersonation session expired mid-task - getting a fresh one...)")
        renewed = impersonate_user(admin_token, target_user_id)
        session["token"] = renewed["access_token"]
        session["jti"] = renewed["jti"]
        return fn(session["token"], *args, **kwargs)


def _do_delete(session, admin_token, target_user_id, all_transactions, filtered):
    if not filtered:
        print("\n(nothing to delete - the current filter matches no transactions)\n")
        return all_transactions

    print("\n  1. Delete ALL currently filtered transactions")
    print("  2. Pick specific ones from the filtered list")
    print("  3. Cancel")
    choice = input("Delete which? (number): ").strip()

    if choice == "1":
        targets = filtered
    elif choice == "2":
        targets = _pick_specific(filtered)
    else:
        print("Cancelled.\n")
        return all_transactions

    if not targets:
        print("Nothing selected.\n")
        return all_transactions

    plural = "s" if len(targets) != 1 else ""
    print(f"\nDelete {len(targets)} transaction{plural}? This cannot be undone.")
    if input("Confirm? (y/n): ").strip().lower() != "y":
        print("Cancelled.\n")
        return all_transactions

    ids = [t["id"] for t in targets]
    try:
        deleted_count = _call_as_user(session, admin_token, target_user_id, delete_transactions, ids)
        print(f"Done - {deleted_count} deleted.\n")
        deleted_ids = set(ids)
        return [t for t in all_transactions if t["id"] not in deleted_ids]
    except Exception as e:
        print(f"Delete failed: {e}\n")
        return all_transactions


def _do_recategorize(session, admin_token, target_user_id, all_transactions, filtered, category_names):
    if not filtered:
        print("\n(nothing to recategorise - the current filter matches no transactions)\n")
        return all_transactions

    print("\n  1. Apply to ALL currently filtered transactions")
    print("  2. Pick specific ones from the filtered list")
    print("  3. Cancel")
    choice = input("Recategorise which? (number): ").strip()

    if choice == "1":
        targets = filtered
    elif choice == "2":
        targets = _pick_specific(filtered)
    else:
        print("Cancelled.\n")
        return all_transactions

    if not targets:
        print("Nothing selected.\n")
        return all_transactions

    new_category = choose_from_list(category_names, lambda c: c, prompt="New category")
    if new_category is None:
        print("Cancelled.\n")
        return all_transactions

    resolutions = [
        {"description": t["description"], "date": t["date"], "amount": t["amount"], "category": new_category}
        for t in targets
    ]

    try:
        result = _call_as_user(session, admin_token, target_user_id, resolve_categories, resolutions)
        skipped_count = len(result.get("skipped", []))
        applied_count = len(targets) - skipped_count
        msg = f'Done - {applied_count} set to "{new_category}"'
        if skipped_count:
            msg += f", {skipped_count} skipped (their category list was likely stale - use 'Refresh from server' and retry)"
        print(msg + ".")
        print('Note: the backend may also silently update OTHER transactions in this '
              'user\'s history that share the exact same description text (this is '
              'existing app behaviour, not specific to this tool - see handoff.txt). '
              "Use 'Refresh from server' to see the full effect.\n")

        target_ids = {t["id"] for t in targets}
        return [
            {**t, "category": new_category} if t["id"] in target_ids else t
            for t in all_transactions
        ]
    except Exception as e:
        print(f"Recategorise failed: {e}\n")
        return all_transactions


def _manage_single_user_session(admin_token, target_user_id, session, username):
    """`session` is a mutable dict {'token', 'jti'} - see _call_as_user
    above for why it needs to be mutable rather than a plain string:
    the impersonation token it holds can be silently swapped out
    mid-session if the 15-minute window runs out."""
    try:
        categories = fetch_categories_full(admin_token)
    except Exception as e:
        print(f"Couldn't fetch categories: {e}\n")
        categories = []
    category_names = [c["name"] for c in categories]

    try:
        transactions = _call_as_user(session, admin_token, target_user_id, fetch_transactions)
    except Exception as e:
        print(f"Couldn't fetch transactions: {e}\n")
        return

    category_filter = set()
    date_from = None
    date_to = None

    while True:
        filtered = _apply_filters(transactions, category_filter, date_from, date_to)
        print(f'\n--- Managing "{username}"\'s transactions --- ({len(filtered)} of {len(transactions)} shown with current filter)')
        print("  1. View filtered transactions")
        print("  2. Set/clear category filter")
        print("  3. Set/clear date range filter")
        print("  4. Group filtered transactions by category")
        print("  5. Delete transactions (from filtered set)")
        print("  6. Set category for transactions (from filtered set)")
        print("  7. Refresh from server")
        print("  8. Done, back")
        choice = input("Action (number): ").strip()

        if choice == "1":
            _print_transactions(filtered)
        elif choice == "2":
            category_filter = _pick_category_filter(category_names, category_filter)
        elif choice == "3":
            date_from, date_to = _pick_date_range(date_from, date_to)
        elif choice == "4":
            _print_grouped_by_category(filtered)
        elif choice == "5":
            transactions = _do_delete(session, admin_token, target_user_id, transactions, filtered)
        elif choice == "6":
            transactions = _do_recategorize(session, admin_token, target_user_id, transactions, filtered, category_names)
        elif choice == "7":
            try:
                transactions = _call_as_user(session, admin_token, target_user_id, fetch_transactions)
                print("Refreshed.\n")
            except Exception as e:
                print(f"Refresh failed: {e}\n")
        elif choice == "8":
            break
        else:
            print("Enter a number from 1 to 8.\n")

    done = input("Revoke this impersonation session now instead of letting it expire on its own? (y/n): ").strip().lower()
    if done == "y":
        try:
            revoke_token(admin_token, session["jti"])
            print("Revoked.\n")
        except Exception as e:
            print(f"Revoke failed (it will still expire naturally regardless): {e}\n")


def run_manage_user_transactions(token):
    """The actual workflow, assuming `token` is already an
    authenticated session. No re-login prompt in here - see
    run_rename() in renameCategoryAdmin.py for the same pattern."""
    try:
        me = fetch_me(token)
    except Exception as e:
        print(f"Couldn't fetch your own account info: {e}\n")
        return

    while True:
        try:
            users = fetch_users(token)
        except Exception as e:
            print(f"Couldn't fetch users: {e}\n")
            break

        # Same hierarchy filter as impersonateUserAdmin.py - you can
        # only act as someone strictly below your own level, owner
        # exempt. The server re-checks this itself when the
        # impersonate call below actually happens.
        actable = [u for u in users if me["role"] == "owner" or u["level"] < me["level"]]
        if not actable:
            print("\nNo users available for you to manage transactions for.\n")
            break

        chosen = choose_from_list(
            actable,
            lambda u: f'{u["username"]} - {u["role"]} (level {u["level"]})',
            prompt="User whose transactions to manage",
        )
        if chosen is None:
            print("Cancelled.")
            break

        try:
            result = impersonate_user(token, chosen["id"])
        except Exception as e:
            print(f"Couldn't get a session for that user: {e}\n")
        else:
            print(f'\nActing as "{result["username"]}".\n')
            session = {"token": result["access_token"], "jti": result["jti"]}
            _manage_single_user_session(token, chosen["id"], session, result["username"])

        again = input("Manage another user's transactions? (y/n): ").strip().lower()
        if again != "y":
            print("Done.")
            break


def main():
    print("Cashflow manage-user-transactions tool")
    print(f"Backend: {BASE_URL}\n")

    token = admin_login_prompt()
    if token is None:
        return

    run_manage_user_transactions(token)


if __name__ == "__main__":
    main()
