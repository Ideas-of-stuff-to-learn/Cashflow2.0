"""
categorise/llm_tier/orchestrator.py

Tier 5 only - LLM categorisation for transactions that couldn't be
resolved by cache tiers. This is the main loop tying batch_recheck.py
and gemini_call.py together, plus the setup (caches, client,
categories) and teardown (merchant/cache saves, result building) that
wraps around them.
"""

import os
import sys
import time

from google import genai

from cache import CategoryCache
from checkingName import NEEDS_MANUAL_REVIEW, NOT_YET_CATEGORISED
from matching import chunked, load_merchants, add_merchants_batch, load_categories
from categorise.helpers import uniqueDescriptions, rowsByDescription
from .empty_result import empty_llm_result
from .batch_recheck import run_batch_recheck
from .gemini_call import run_gemini_call

DEFAULT_GEMINI_REQUEST_TIMEOUT_MS = 30000


def run_llm_tier(pending_transactions: list, user_id: str, conn, batch_size: int = 200, gemini_timeout_ms: int = None) -> dict:
    """Tier 5 only - LLM categorisation for transactions that couldn't
    be resolved by cache tiers. Accepts only the PENDING_LLM
    transactions from run_cache_tiers(), never re-runs the cache checks.
    """
    if not pending_transactions:
        return empty_llm_result()

    total_transactions = len(pending_transactions)
    effective_gemini_timeout_ms = gemini_timeout_ms if gemini_timeout_ms is not None else DEFAULT_GEMINI_REQUEST_TIMEOUT_MS

    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        raise RuntimeError('GEMINI_API_KEY environment variable not set')

    client = genai.Client(api_key=api_key)
    global_cache = CategoryCache(conn, scope='global')
    personal_cache = CategoryCache(conn, scope='personal', user_id=user_id)
    global_cache.preload()
    personal_cache.preload()
    normalized_merchants = load_merchants(conn)

    default_categories = [NEEDS_MANUAL_REVIEW] + load_categories(conn)

    unique_descriptions = uniqueDescriptions(pending_transactions)
    rows_by_description = rowsByDescription(pending_transactions)

    category_by_description = {}
    failed_descriptions = set()
    ambiguous_descriptions = set()

    pseudo_transactions = [{'description': d} for d in unique_descriptions]

    # Pre-existing resolved global/personal descriptions, loaded ONCE -
    # the per-batch re-check merges these with category_by_description
    # (which grows as THIS run resolves more), so a later batch can
    # match against BOTH what was already known before this run started
    # AND whatever this run has already resolved so far.
    global_resolved = global_cache.resolved_descriptions()
    personal_resolved = personal_cache.resolved_descriptions()

    # Accumulates newly-learned merchants across the WHOLE run (every
    # Gemini batch), written in ONE add_merchants_batch() call at the
    # end.
    newly_learned_merchants = []

    batches = list(chunked(pseudo_transactions, batch_size))

    timings = {
        'exact_ms': 0, 'merchant_ms': 0, 'similarity_ms': 0, 'recheck_ms': 0,
        'gemini_ms': 0, 'merchant_write_ms': 0, 'global_cache_save_ms': 0,
        'personal_cache_save_ms': 0, 'batches': len(batches), 'gemini_calls': 0,
        'exact_transactions': 0, 'exact_percentage': 0.0,
        'merchant_transactions': 0, 'merchant_percentage': 0.0,
        'similarity_transactions': 0, 'similarity_percentage': 0.0,
        'gemini_transactions': 0, 'gemini_percentage': 0.0,
    }

    for batch_index, batch in enumerate(batches):
        try:
            batch_descriptions = [item['description'] for item in batch]

            resolved_updates, merchant_hits, similarity_hits, still_needing_llm_descriptions, timing_summary = run_batch_recheck(
                batch_descriptions, personal_resolved, global_resolved,
                category_by_description, normalized_merchants,
                rows_by_description, timings,
            )

            category_by_description.update(resolved_updates)

            # Same cache-writing this used to do inline - merchant and
            # similarity hits specifically get written to the global
            # cache (personal/global exact hits are already cached,
            # nothing to write for those).
            for desc, cat in merchant_hits.items():
                for row in rows_by_description.get(desc, []):
                    global_cache.add_record(desc, row['date'], row['amount'], cat)
            for desc, cat in similarity_hits.items():
                for row in rows_by_description.get(desc, []):
                    global_cache.add_record(desc, row['date'], row['amount'], cat)

            still_needing_llm = [
                item for item in batch
                if item['description'] in still_needing_llm_descriptions
            ]

            print(
                f"  [stage timing] exact: {timing_summary['exact_elapsed']:.2f}s | "
                f"merchant: {timing_summary['merchant_elapsed']:.2f}s | "
                f"similarity: {timing_summary['similarity_elapsed']:.2f}s | "
                f"total re-check: {timing_summary['recheck_elapsed']:.2f}s "
                f"({timing_summary['merchant_hit_count']} merchant hit(s), "
                f"{timing_summary['similarity_hit_count']} similarity hit(s), "
                f"{len(still_needing_llm)}/{len(batch)} still need the LLM)",
                file=sys.stderr,
            )

            if not still_needing_llm:
                continue

            llm_elapsed = run_gemini_call(
                client, still_needing_llm, default_categories, effective_gemini_timeout_ms,
                global_cache, personal_cache, normalized_merchants, personal_resolved,
                category_by_description, newly_learned_merchants, ambiguous_descriptions,
                failed_descriptions, rows_by_description, timings,
            )

            print(
                f"  [stage timing] Gemini call: {llm_elapsed:.2f}s ({len(still_needing_llm)} descriptions)",
                file=sys.stderr,
            )

        except Exception as e:
            # A batch-level failure (Gemini down, a bug, anything) no
            # longer aborts the WHOLE run - only THIS batch, and every
            # batch not yet attempted, gets marked FAILED - rerun.
            print(f"  [stage timing] batch {batch_index + 1}/{len(batches)} failed: {e}", file=sys.stderr)
            for remaining_batch in batches[batch_index:]:
                for item in remaining_batch:
                    failed_descriptions.add(item['description'])
            break

    if total_transactions > 0:
        timings['exact_percentage'] = round(timings['exact_transactions'] / total_transactions * 100, 2)
        timings['merchant_percentage'] = round(timings['merchant_transactions'] / total_transactions * 100, 2)
        timings['similarity_percentage'] = round(timings['similarity_transactions'] / total_transactions * 100, 2)
        timings['gemini_percentage'] = round(timings['gemini_transactions'] / total_transactions * 100, 2)

    merchants_start = time.perf_counter()
    add_merchants_batch(conn, newly_learned_merchants)
    merchants_elapsed = time.perf_counter() - merchants_start
    timings['merchant_write_ms'] = merchants_elapsed * 1000
    print(f"  [stage timing] merchant write: {merchants_elapsed:.2f}s ({len(newly_learned_merchants)} merchant(s))", file=sys.stderr)

    if global_cache.dirty:
        global_save_start = time.perf_counter()
        global_cache.save()
        global_save_elapsed = time.perf_counter() - global_save_start
        timings['global_cache_save_ms'] = global_save_elapsed * 1000
        print(f"  [stage timing] global cache save: {global_save_elapsed:.2f}s", file=sys.stderr)

    if personal_cache.dirty:
        personal_save_start = time.perf_counter()
        personal_cache.save()
        personal_save_elapsed = time.perf_counter() - personal_save_start
        timings['personal_cache_save_ms'] = personal_save_elapsed * 1000
        print(f"  [stage timing] personal cache save: {personal_save_elapsed:.2f}s", file=sys.stderr)

    result = []
    for txn in pending_transactions:
        desc = txn['description']

        if desc in category_by_description:
            category = category_by_description[desc]
        elif desc in failed_descriptions:
            category = NOT_YET_CATEGORISED
        elif desc in ambiguous_descriptions:
            category = NEEDS_MANUAL_REVIEW
        else:
            category = NOT_YET_CATEGORISED

        result.append({
            'id': txn.get('id'),
            'date': txn['date'],
            'description': txn['description'],
            'amount': float(txn['amount']),
            'category': category,
        })

    return {
        'transactions': result,
        'timings': timings,
    }