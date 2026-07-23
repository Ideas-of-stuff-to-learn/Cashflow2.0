"""
categorization/pipeline.py

Convenience wrapper chaining all three cache-tier phases
(exact -> merchant -> similarity) in ONE call.
"""

from .exact_tier import run_exact_tier
from .merchant_tier import run_merchant_tier
from .similarity_tier import run_similarity_tier


def run_cache_tiers(transactions: list, user_id: str, conn) -> list:
    """Convenience wrapper chaining all three cache phases in ONE call -
    kept for any caller that wants the old single-request behavior
    (e.g. a script, or a test). The /categorize/cached/* routes in
    routes/transactions.py call run_exact_tier / run_merchant_tier /
    run_similarity_tier directly instead, one per HTTP round trip, so
    the frontend can apply each phase's results (and let the user see
    them) as soon as they land, rather than waiting for all three
    tiers plus the LLM before anything appears to update.
    """
    def _key(row):
        rid = row.get('id')
        return rid if rid is not None else (row['date'], row['description'], row['amount'])

    final = {}
    still_pending = transactions

    exact_result = run_exact_tier(still_pending, user_id, conn)
    for row in exact_result:
        final[_key(row)] = row
    still_pending = [r for r in exact_result if r['category'] == 'PENDING_LLM']

    if still_pending:
        merchant_result = run_merchant_tier(still_pending, conn)
        for row in merchant_result:
            final[_key(row)] = row
        still_pending = [r for r in merchant_result if r['category'] == 'PENDING_LLM']

    if still_pending:
        similarity_result = run_similarity_tier(still_pending, conn)
        for row in similarity_result:
            final[_key(row)] = row

    # Preserve the original transaction order in the returned list.
    ordered = []
    for txn in transactions:
        rid = txn.get('id')
        key = rid if rid is not None else (txn['date'], txn['description'], float(txn['amount']))
        ordered.append(final.get(key))
    return ordered