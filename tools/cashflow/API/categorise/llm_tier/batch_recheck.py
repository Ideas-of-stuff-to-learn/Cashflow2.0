"""
categorise/llm_tier/batch_recheck.py

Per-batch re-check against everything learned so far in THIS LLM run,
before spending a Gemini call on anything. A later batch can easily
contain a close variant of something an earlier batch in the SAME run
already resolved (a different store number, a slightly different
format), and both match_known_merchants_batch and
find_similar_cached_descriptions_batch are cheap (Aho-Corasick /
n-gram-filtered, no LLM call) compared to what they might save.
"""

import time

from matching import match_known_merchants_batch, find_similar_cached_descriptions_batch

def run_batch_recheck(batch_descriptions, personal_resolved, global_resolved, category_by_description, normalized_merchants, rows_by_description, timings):
    """Runs the exact -> merchant -> similarity re-check for one LLM
    batch's descriptions. Mutates `timings` in place (accumulating
    elapsed time and per-tier transaction counts across the whole run).

    Returns (category_by_description_updates, still_needing_llm_descriptions):
      - category_by_description_updates: dict of desc -> category for
        everything this re-check resolved (personal/global exact hits,
        merchant hits, similarity hits) - caller merges this into the
        running category_by_description and writes merchant/similarity
        hits to the global cache.
      - still_needing_llm_descriptions: set of descriptions that
        survived all three re-check steps and genuinely need the LLM.
    """
    exact_start = time.perf_counter()
    recheck_start = time.perf_counter()

    personal_hits = {
        desc: personal_resolved[desc]
        for desc in batch_descriptions
        if desc in personal_resolved
    }

    global_hits = {
        desc: global_resolved[desc]
        for desc in batch_descriptions
        if desc not in personal_hits and desc in global_resolved
    }

    exactly_resolved = set(personal_hits) | set(global_hits)
    timings['exact_transactions'] += sum(
        len(rows_by_description.get(desc, []))
        for desc in exactly_resolved
    )

    after_exact = [
        desc
        for desc in batch_descriptions
        if desc not in exactly_resolved
    ]

    exact_elapsed = time.perf_counter() - exact_start
    timings['exact_ms'] += exact_elapsed * 1000
    merchant_start = time.perf_counter()

    merchant_hits = match_known_merchants_batch(after_exact, normalized_merchants)
    timings['merchant_transactions'] += sum(
        len(rows_by_description.get(desc, []))
        for desc in merchant_hits
    )
    after_merchants = [
        desc
        for desc in after_exact
        if desc not in merchant_hits
    ]
    merchant_elapsed = time.perf_counter() - merchant_start
    timings['merchant_ms'] += merchant_elapsed * 1000
    similarity_start = time.perf_counter()

    resolved_lookup = list(global_resolved.keys()) + list(category_by_description.keys())
    resolved_categories = {**global_resolved, **category_by_description}

    similarity_hits = find_similar_cached_descriptions_batch(after_merchants, resolved_lookup, resolved_categories)
    timings['similarity_transactions'] += sum(
        len(rows_by_description.get(desc, []))
        for desc in similarity_hits
    )
    similarity_elapsed = time.perf_counter() - similarity_start
    timings['similarity_ms'] += similarity_elapsed * 1000
    recheck_elapsed = time.perf_counter() - recheck_start
    timings['recheck_ms'] += recheck_elapsed * 1000

    resolved_updates = {}
    resolved_updates.update(personal_hits)
    resolved_updates.update(global_hits)
    resolved_updates.update(merchant_hits)
    resolved_updates.update(similarity_hits)

    still_needing_llm_descriptions = {
        desc
        for desc in after_merchants
        if desc not in similarity_hits
    }

    timing_summary = {
        'exact_elapsed': exact_elapsed,
        'merchant_elapsed': merchant_elapsed,
        'similarity_elapsed': similarity_elapsed,
        'recheck_elapsed': recheck_elapsed,
        'merchant_hit_count': len(merchant_hits),
        'similarity_hit_count': len(similarity_hits),
    }

    return resolved_updates, merchant_hits, similarity_hits, still_needing_llm_descriptions, timing_summary