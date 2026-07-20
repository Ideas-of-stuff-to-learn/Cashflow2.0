"""
shared.py

Helpers used by more than one routes/*.py module. Kept separate from
extensions.py (which is Flask/JWT/limiter setup) since this is plain
application logic, not framework wiring.
"""
from psycopg2.extras import execute_values

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

    ONE round trip to Postgres regardless of how many rows are being
    written, via execute_values - not one execute() call per row. The
    previous version looped cur.execute() once per transaction, which
    meant a chunk of 1000 resolved rows cost 1000 sequential network
    round trips to the DB. That's what actually caused the gunicorn
    WORKER TIMEOUT (and the resulting SIGKILL + corrupted connection
    pool - the "SSL error: decryption failed or bad record mac" seen on
    the next request) when CACHE_CHUNK_SIZE was raised to 1000 - not
    the categorization logic itself, which is genuinely fast (dict
    lookups for the exact tier). A single bulk UPDATE...FROM (VALUES
    ...) does the exact same writes in one round trip no matter how
    many rows there are, so this scales with chunk size the way the
    algorithmic work already does.
    """
    rows = [
        (item['id'], item['category'], user_id)
        for item in result
        if item.get('id') is not None and item.get('category') not in TRANSIENT_CATEGORY_VALUES
    ]
    if not rows:
        return

    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            UPDATE transactions AS t
            SET category = v.category
            FROM (VALUES %s) AS v(id, category, user_id)
            WHERE t.id = v.id AND t.user_id = v.user_id
            """,
            rows,
            template="(%s, %s, %s)",
        )