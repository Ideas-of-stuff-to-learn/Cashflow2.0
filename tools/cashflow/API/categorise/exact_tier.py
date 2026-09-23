"""
categorization/exact_tier.py

Phase 1 of the cache pipeline - personal/global EXACT cache lookups
only, both O(1) dict lookups regardless of cache size.
"""

from cache import CategoryCache
from checkingName import NEEDS_MANUAL_REVIEW
from .helpers import (
    row_already_recorded,
    uniqueDescriptions,
    rowsByDescription,
    build_result_rows,
)


def combined_status(desc, personal_cache, global_cache):
    """Returns combined cache status and category if resolved."""

    personal_records = personal_cache.records_for(desc)
    global_records = global_cache.records_for(desc)

    all_records = personal_records + global_records

    if not all_records:
        return {
            "status": "unknown",
            "category": None
        }

    has_pending = any(
        r["category"] == NEEDS_MANUAL_REVIEW
        for r in all_records
    )

    answered_categories = {
        r["category"]
        for r in all_records
        if r["category"] != NEEDS_MANUAL_REVIEW
    }

    if has_pending:
        return {
            "status": "pending",
            "category": None
        }

    if len(answered_categories) > 1:
        return {
            "status": "ambiguous",
            "category": None
        }

    if len(answered_categories) == 1:
        return {
            "status": "resolved",
            "category": next(iter(answered_categories))
        }

    return {
        "status": "unknown",
        "category": None
    }


def run_exact_tier(transactions: list, user_id: str, conn) -> list:
    """Phase 1 of the cache pipeline - personal/global EXACT cache
    lookups only, both O(1) dict lookups regardless of cache size. Also
    handles the "ambiguous/pending" outcome (a description whose cache
    history already proves it can't be trusted alone) - that's still a
    pure cache-history check, not fuzzy/merchant work, so it belongs in
    this phase too.

    Anything not resolved here comes back as 'PENDING_LLM' (see
    build_result_rows) - the frontend sends those rows into
    run_merchant_tier next.
    """
    global_cache = CategoryCache(conn, scope='global')
    personal_cache = CategoryCache(conn, scope='personal', user_id=user_id)
    global_cache.preload()
    personal_cache.preload()

    unique_descriptions = uniqueDescriptions(transactions)
    rows_by_description = rowsByDescription(transactions)

    category_by_description = {}
    ambiguous_descriptions = set()

    for desc in unique_descriptions:
        status = combined_status(desc, personal_cache, global_cache)
        if status['status'] == 'resolved':
            category = status['category']
            if category:
                category_by_description[desc] = category
                continue
        if status['status'] in ('ambiguous', 'pending'):
            existing_personal = {(r['date'], str(r['amount'])) for r in personal_cache.records_for(desc)}
            existing_global = {(r['date'], str(r['amount'])) for r in global_cache.records_for(desc)}
            for row in rows_by_description.get(desc, []):
                inPersonal, inGlobal = row_already_recorded(row, existing_personal, existing_global)
                if not inPersonal and not inGlobal:
                    personal_cache.add_record(desc, row['date'], row['amount'], NEEDS_MANUAL_REVIEW)
                    existing_personal.add((row['date'], str(row['amount'])))
            ambiguous_descriptions.add(desc)

    if personal_cache.dirty:
        personal_cache.save()
    # global_cache is read-only in this phase - nothing writes to it here.

    return build_result_rows(transactions, category_by_description, ambiguous_descriptions, personal_cache, global_cache)