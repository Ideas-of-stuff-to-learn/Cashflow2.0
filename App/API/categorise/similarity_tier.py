"""
categorization/similarity_tier.py

Phase 3 of the cache pipeline - fuzzy match against the GLOBAL CACHE's
own already-resolved description history.
"""

from cache import CategoryCache
from matching import find_similar_cached_descriptions_batch
from .helpers import uniqueDescriptions, rowsByDescription, build_result_rows


def run_similarity_tier(transactions: list, conn) -> list:
    """Phase 3 - fuzzy match against the GLOBAL CACHE's own already-
    resolved description history (NOT merchants - see run_merchant_tier
    for that). Uses find_similar_cached_descriptions_batch() - the same
    n-gram/IDF-filtered approach as the merchant tier's fuzzy fallback,
    applied here since this whole tier is fuzzy-similarity-only from
    the start (fuzz.ratio, no exact-substring step).

    Whatever's still unresolved after this comes back as 'PENDING_LLM'
    for real this time - the frontend sends those rows to
    /categorize/llm next.
    """
    global_cache = CategoryCache(conn, scope='global')
    global_cache.preload()
    resolved = global_cache.resolved_descriptions()
    resolved_lookup = list(resolved.keys())

    unique_descriptions = uniqueDescriptions(transactions)
    rows_by_description = rowsByDescription(transactions)

    category_by_description = find_similar_cached_descriptions_batch(unique_descriptions, resolved_lookup, resolved)

    for desc, category in category_by_description.items():
        for row in rows_by_description.get(desc, []):
            global_cache.add_record(desc, row['date'], row['amount'], category)

    if global_cache.dirty:
        global_cache.save()

    return build_result_rows(transactions, category_by_description, (), None, global_cache)