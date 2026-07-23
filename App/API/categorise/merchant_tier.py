"""
categorization/merchant_tier.py

Phase 2 of the cache pipeline - merchant dictionary match, for
descriptions the exact tier couldn't resolve.
"""

from cache import CategoryCache
from categoriseAugDB import match_known_merchants_batch, load_merchants
from .helpers import uniqueDescriptions, rowsByDescription, build_result_rows


def run_merchant_tier(transactions: list, conn) -> list:
    """Phase 2 - merchant dictionary match, for descriptions the exact
    tier couldn't resolve. Uses match_known_merchants_batch()
    (categoriseAugDB.py) - Aho-Corasick for exact substring hits, then
    an n-gram/IDF-filtered fuzzy fallback for whatever's left - across
    the WHOLE chunk at once, instead of looping match_known_merchant()
    per description.

    Writes hits to the GLOBAL cache, same as the original single-pass
    tier did, so a merchant hit becomes an ordinary Tier-1 exact hit
    for every future request (from anyone, not just this user).
    """
    global_cache = CategoryCache(conn, scope='global')
    global_cache.preload()
    normalized_merchants = load_merchants(conn)

    unique_descriptions = uniqueDescriptions(transactions)
    rows_by_description = rowsByDescription(transactions)

    category_by_description = match_known_merchants_batch(unique_descriptions, normalized_merchants)

    for desc, category in category_by_description.items():
        for row in rows_by_description.get(desc, []):
            global_cache.add_record(desc, row['date'], row['amount'], category)

    if global_cache.dirty:
        global_cache.save()

    return build_result_rows(transactions, category_by_description, (), None, global_cache)