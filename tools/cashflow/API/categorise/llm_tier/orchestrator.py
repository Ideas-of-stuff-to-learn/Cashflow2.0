"""
categorise/llm_tier/orchestrator.py

Tier 5 only - LLM categorisation for transactions that couldn't be
resolved by cache tiers. This is the main loop tying batch_recheck.py
and gemini_call.py together, plus the setup (caches, client,
categories) and teardown (merchant/cache saves, result building) that
wraps around them.

Optimisations in this file:
- Pipeline (B): each batch's recheck is pre-started as a background
  thread immediately after category_by_description is updated, so it
  overlaps with the previous batch's Gemini call. Snapshots of
  category_by_description, normalized_merchants, and personal_resolved
  are passed to the thread to avoid racing against Gemini's writes.
- Async saves (A): the final cache/merchant DB writes are done in a
  background thread after the result dict is built and returned, so
  the route handler responds immediately instead of stalling post-100%.
"""

import os
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor

from google import genai

from cache import CategoryCache
from checkingName import NEEDS_MANUAL_REVIEW, NOT_YET_CATEGORISED
from database import get_connection, release_connection
from matching import chunked, load_merchants, add_merchants_batch, load_categories
from categorise.helpers import uniqueDescriptions, rowsByDescription
from .empty_result import empty_llm_result
from .batch_recheck import run_batch_recheck
from .gemini_call import run_gemini_call

DEFAULT_GEMINI_REQUEST_TIMEOUT_MS = 30000


def _run_recheck(batch_descriptions, personal_resolved, global_resolved, category_by_description, normalized_merchants, rows_by_description):
    """Wrapper around run_batch_recheck with its own timings dict so it
    can be submitted to a thread without sharing the main accumulator."""
    t = {
        'exact_transactions': 0, 'merchant_transactions': 0, 'similarity_transactions': 0,
        'exact_ms': 0.0, 'merchant_ms': 0.0, 'similarity_ms': 0.0, 'recheck_ms': 0.0,
    }
    result = run_batch_recheck(
        batch_descriptions, personal_resolved, global_resolved,
        category_by_description, normalized_merchants,
        rows_by_description, t,
    )
    return t, result


def _background_cache_save(global_cache, personal_cache, newly_learned_merchants):
    """Flushes merchant writes and dirty caches to the DB in a background
    thread after the main result has already been returned. Gets its own
    connection so the route handler's connection can be released first."""
    conn = get_connection()
    try:
        global_cache.conn = conn
        personal_cache.conn = conn

        t = time.perf_counter()
        add_merchants_batch(conn, newly_learned_merchants)
        print(f"  [async save] merchant write: {time.perf_counter() - t:.2f}s ({len(newly_learned_merchants)} merchant(s))", file=sys.stderr)

        if global_cache.dirty:
            t = time.perf_counter()
            global_cache.save()
            print(f"  [async save] global cache save: {time.perf_counter() - t:.2f}s", file=sys.stderr)

        if personal_cache.dirty:
            t = time.perf_counter()
            personal_cache.save()
            print(f"  [async save] personal cache save: {time.perf_counter() - t:.2f}s", file=sys.stderr)

    except Exception as e:
        print(f"  [async save] background cache save failed: {e}", file=sys.stderr)
        try:
            conn.rollback()
        except Exception:
            pass
    finally:
        release_connection(conn)


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

    # Pre-existing resolved descriptions, loaded ONCE before the loop.
    # The per-batch re-check merges these with category_by_description
    # (which grows as THIS run resolves more), so a later batch can
    # match against BOTH what was already known before this run AND
    # whatever this run has already resolved.
    global_resolved = global_cache.resolved_descriptions()
    personal_resolved = personal_cache.resolved_descriptions()

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

    executor = ThreadPoolExecutor(max_workers=1)
    next_recheck_future = None

    for batch_index, batch in enumerate(batches):
        try:
            batch_descriptions = [item['description'] for item in batch]

            # Use pre-computed recheck if the previous iteration started
            # it early (pipeline), otherwise run synchronously.
            if next_recheck_future is not None:
                batch_timings, recheck_result = next_recheck_future.result()
                next_recheck_future = None
            else:
                batch_timings, recheck_result = _run_recheck(
                    batch_descriptions, personal_resolved, global_resolved,
                    category_by_description, normalized_merchants, rows_by_description,
                )

            for k, v in batch_timings.items():
                timings[k] = timings.get(k, 0) + v

            resolved_updates, merchant_hits, similarity_hits, still_needing_llm_descriptions, timing_summary = recheck_result

            category_by_description.update(resolved_updates)

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

            # Pipeline: pre-start the next batch's recheck now so it
            # overlaps with the Gemini call below. Pass snapshots of the
            # mutable shared dicts to avoid racing against Gemini's writes
            # to category_by_description, personal_resolved, and
            # normalized_merchants. global_resolved is never mutated after
            # construction so it's safe to share directly.
            next_batch_index = batch_index + 1
            if next_batch_index < len(batches) and still_needing_llm:
                next_recheck_future = executor.submit(
                    _run_recheck,
                    [item['description'] for item in batches[next_batch_index]],
                    dict(personal_resolved),
                    global_resolved,
                    dict(category_by_description),
                    dict(normalized_merchants),
                    rows_by_description,
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
            print(f"  [stage timing] batch {batch_index + 1}/{len(batches)} failed: {e}", file=sys.stderr)
            for remaining_batch in batches[batch_index:]:
                for item in remaining_batch:
                    failed_descriptions.add(item['description'])
            break

    executor.shutdown(wait=False)

    if total_transactions > 0:
        timings['exact_percentage'] = round(timings['exact_transactions'] / total_transactions * 100, 2)
        timings['merchant_percentage'] = round(timings['merchant_transactions'] / total_transactions * 100, 2)
        timings['similarity_percentage'] = round(timings['similarity_transactions'] / total_transactions * 100, 2)
        timings['gemini_percentage'] = round(timings['gemini_transactions'] / total_transactions * 100, 2)

    # Async saves (A): fire cache and merchant DB writes in the background
    # and return immediately. The visible post-100% stall is eliminated.
    # If the save thread fails, categorisation results are still correct
    # for this request — the cache just won't benefit future requests.
    threading.Thread(
        target=_background_cache_save,
        args=(global_cache, personal_cache, newly_learned_merchants),
        daemon=True,
    ).start()

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
