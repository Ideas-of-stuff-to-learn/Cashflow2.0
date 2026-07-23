"""
categorise/llm_tier/gemini_call.py

Calling the LLM for whatever survived the batch re-check, and
processing its results into the caches / newly-learned merchants list.
This is "what happens once we've decided we truly need Gemini" - the
cheap pre-filtering that decides WHETHER we need it lives in
batch_recheck.py instead.
"""

import time

from checkingName import NEEDS_MANUAL_REVIEW
from categoriseAugDB import categorize_batch, normalize_for_matching, invalidate_merchant_automaton


def run_gemini_call(client, still_needing_llm, default_categories, gemini_timeout_ms, global_cache, personal_cache, normalized_merchants, personal_resolved, category_by_description, newly_learned_merchants, ambiguous_descriptions, failed_descriptions, rows_by_description, timings):
    """Calls categorize_batch for `still_needing_llm` (a list of
    {'description': ...} pseudo-transactions) and writes every result
    into the appropriate cache, mutating category_by_description,
    newly_learned_merchants, ambiguous_descriptions, failed_descriptions,
    personal_resolved, normalized_merchants, and timings in place -
    same mutation contract the original inline code had, just moved
    into its own function.

    Returns the elapsed Gemini call time in seconds (for the caller's
    own stage-timing print line).
    """
    timings['gemini_transactions'] += sum(
        len(rows_by_description.get(item['description'], []))
        for item in still_needing_llm
    )
    llm_start = time.perf_counter()

    cats = categorize_batch(
        client,
        still_needing_llm,
        default_categories,
        gemini_timeout_ms=gemini_timeout_ms,
    )

    llm_elapsed = time.perf_counter() - llm_start
    timings['gemini_ms'] += llm_elapsed * 1000
    timings['gemini_calls'] += 1

    for item, result in zip(still_needing_llm, cats):
        desc = item['description']

        if result is None:
            failed_descriptions.add(desc)
            continue

        cat = result['category']
        merchant = result['merchant']

        if cat == NEEDS_MANUAL_REVIEW:
            for row in rows_by_description.get(desc, []):
                global_cache.add_record(desc, row['date'], row['amount'], NEEDS_MANUAL_REVIEW)
            ambiguous_descriptions.add(desc)
        else:
            category_by_description[desc] = cat

            normalized = normalize_for_matching(merchant) if merchant and isinstance(merchant, str) else ''
            has_merchant = len(normalized) >= 3
            target_cache = global_cache if has_merchant else personal_cache

            for row in rows_by_description.get(desc, []):
                target_cache.add_record(desc, row['date'], row['amount'], cat)

            if has_merchant and normalized not in normalized_merchants:
                normalized_merchants[normalized] = cat
                newly_learned_merchants.append((normalized, cat))
                # Invalidate NOW, not just when add_merchants_batch
                # finally writes this to the DB at the end of the run -
                # the mid-run re-check (for the NEXT batch) calls
                # match_known_merchants_batch(), which needs the
                # automaton to reflect this merchant immediately, even
                # though its DB write is deferred.
                invalidate_merchant_automaton()
            elif not has_merchant:
                personal_resolved[desc] = cat

    return llm_elapsed