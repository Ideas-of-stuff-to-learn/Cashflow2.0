"""
shared.py

Helpers used by more than one routes/*.py module. Kept separate from
extensions.py (which is Flask/JWT/limiter setup) since this is plain
application logic, not framework wiring.
"""

# Category values that are placeholders, not a real final answer yet -
# used both to skip writing them back to the transactions table
# (update_transaction_categories below) and to exclude them from chart
# aggregates (routes/charts.py) and manual-review counts.
TRANSIENT_CATEGORY_VALUES = {'PENDING_LLM', 'FAILED - rerun'}


def update_transaction_categories(conn, user_id, result):
    """Writes each transaction's resolved category back into the
    transactions table, by its real database id. Skips items with no id
    (shouldn't happen for anything that went through parse_csv) and
    items still sitting at a transient/placeholder category - those
    aren't a final answer yet, so the stored row is left as NULL until
    a later tier or manual resolution actually settles it.

    Used after EACH cache-tier phase (exact/merchant/similarity) as
    well as the LLM tier and manual resolve - safe to call repeatedly
    with partial results, since it only ever writes rows that have a
    real, final category.
    """
    with conn.cursor() as cur:
        for item in result:
            txn_id = item.get('id')
            category = item.get('category')
            if txn_id is None or category in TRANSIENT_CATEGORY_VALUES:
                continue
            cur.execute(
                "UPDATE transactions SET category = %s WHERE id = %s AND user_id = %s",
                (category, txn_id, user_id),
            )
