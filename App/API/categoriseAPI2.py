import os
import sys

from dotenv import load_dotenv
from google import genai

from cache import CategoryCache
from checkingName import NEEDS_MANUAL_REVIEW

# Import all reusable logic directly from categoriseAug - no rewriting needed
from categoriseAugDB import (
    categorize_batch,
    chunked,
    match_known_merchants_batch,
    find_similar_cached_descriptions_batch,
    normalize_for_matching,
    load_merchants,
    add_merchant,
    add_merchants_batch,
    load_categories,
    DEFAULT_GEMINI_REQUEST_TIMEOUT_MS,
)

load_dotenv()

def row_already_recorded(row, existing_personal, existing_global):
    key = (row['date'], str(row['amount']))
    return key in existing_personal, key in existing_global

def uniqueDescriptions(transactions):

    unique_descriptions = []
    seen = set()
    for t in transactions:
        desc = t['description']
        if desc not in seen:
            seen.add(desc)
            unique_descriptions.append(desc)
    return unique_descriptions

def rowsByDescription(transactions):
    rows_by_description = {}
    for t in transactions:
        rows_by_description.setdefault(t['description'], []).append(t)
    return rows_by_description

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

def _build_result_rows(transactions, category_by_description, ambiguous_descriptions=(), personal_cache=None, global_cache=None):
    """Shared by all three phase functions below - builds the final
    per-transaction result list in the same {id, date, description,
    amount, category} shape the frontend/update_transaction_categories
    already expect. Anything not in category_by_description and not
    ambiguous is reported as 'PENDING_LLM' - reused as the generic
    "not yet resolved by ANY tier" sentinel across all three phases;
    which phase just ran (and therefore what "still pending" means
    next - the next cache phase, or the LLM) is tracked by the CALLER
    (the frontend), not encoded in the value itself.
    """
    ambiguous_descriptions = set(ambiguous_descriptions)
    result = []
    for txn in transactions:
        desc = txn['description']
        if desc in category_by_description:
            category = category_by_description[desc]
        elif desc in ambiguous_descriptions:
            category = NEEDS_MANUAL_REVIEW
            if personal_cache is not None:
                for record in personal_cache.records_for(desc):
                    if record['date'] == txn['date'] and str(record['amount']) == str(txn['amount']):
                        category = record['category']
                        break
            if category == NEEDS_MANUAL_REVIEW and global_cache is not None:
                for record in global_cache.records_for(desc):
                    if record['date'] == txn['date'] and str(record['amount']) == str(txn['amount']):
                        category = record['category']
                        break
        else:
            category = 'PENDING_LLM'

        result.append({
            'id': txn.get('id'),
            'date': txn['date'],
            'description': txn['description'],
            'amount': float(txn['amount']),
            'category': category,
        })
    return result


def run_exact_tier(transactions: list, user_id: str, conn) -> list:
    """Phase 1 of the cache pipeline - personal/global EXACT cache
    lookups only, both O(1) dict lookups regardless of cache size. Also
    handles the "ambiguous/pending" outcome (a description whose cache
    history already proves it can't be trusted alone) - that's still a
    pure cache-history check, not fuzzy/merchant work, so it belongs in
    this phase too.

    Anything not resolved here comes back as 'PENDING_LLM' (see
    _build_result_rows) - the frontend sends those rows into
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

    return _build_result_rows(transactions, category_by_description, ambiguous_descriptions, personal_cache, global_cache)


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

    return _build_result_rows(transactions, category_by_description, (), None, global_cache)


def run_similarity_tier(transactions: list, conn) -> list:
    """Phase 3 - fuzzy match against the GLOBAL CACHE's own already-
    resolved description history (NOT merchants - see run_merchant_tier
    above for that). Uses find_similar_cached_descriptions_batch() -
    the same n-gram/IDF-filtered approach as the merchant tier's fuzzy
    fallback, applied here since this whole tier is fuzzy-similarity-
    only from the start (fuzz.ratio, no exact-substring step).

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

    return _build_result_rows(transactions, category_by_description, (), None, global_cache)


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


def run_llm_tier(pending_transactions: list, user_id: str, conn, batch_size: int = 200, gemini_timeout_ms: int = None) -> list:
    """Tier 5 only - LLM categorisation for transactions that couldn't
    be resolved by cache tiers. Accepts only the PENDING_LLM transactions
    from run_cache_tiers(), never re-runs the cache checks.
    """
    if not pending_transactions:
        return []

    # Frontend controls this via gemini_timeout_ms on the request (see
    # GEMINI_REQUEST_TIMEOUT_MS in useFileProcessor.js) - fall back to
    # the safe default if it wasn't sent (e.g. called directly, not via
    # the /categorize/llm route).
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
 
    DEFAULT_CATEGORIES = [NEEDS_MANUAL_REVIEW] + load_categories(conn)

    unique_descriptions = uniqueDescriptions(pending_transactions)


    rows_by_description = rowsByDescription(pending_transactions)

    category_by_description = {}
    failed_descriptions = set()
    ambiguous_descriptions = set()

    pseudo_transactions = [{'description': d} for d in unique_descriptions]

    for batch in chunked(pseudo_transactions, batch_size):
        cats = categorize_batch(client, batch, DEFAULT_CATEGORIES, gemini_timeout_ms=effective_gemini_timeout_ms)
        # Collected across this ONE Gemini batch, written in a single
        # add_merchants_batch() call after the batch finishes - see
        # that function's docstring for why per-batch (not per-request)
        # is the right granularity to keep most of the old per-item
        # commit's "persists even if something later fails" property.
        newly_learned_merchants = []
        # --- TEMPORARY DIAGNOSTIC ---
        # merchants ended up empty in production despite obviously
        # merchant-bearing descriptions (TESCO, BOOTS, etc.) getting
        # real categories - this print shows exactly what the RAW
        # `merchant` value from Gemini was for every item that didn't
        # end up counted as has_merchant, so the actual cause (null?
        # empty string? something unexpected?) is directly visible in
        # the next run's logs instead of inferred. Safe to remove once
        # the cause is confirmed.
        batch_has_merchant_count = 0
        batch_total_count = 0
        for item, result in zip(batch, cats):
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

                batch_total_count += 1
                if has_merchant:
                    batch_has_merchant_count += 1
                else:
                    print(
                        f"  [merchant diagnostic] desc={desc!r} raw_merchant={merchant!r} "
                        f"(type={type(merchant).__name__}) normalized={normalized!r} -> NO merchant recorded",
                        file=sys.stderr,
                    )

                for row in rows_by_description.get(desc, []):
                    target_cache.add_record(desc, row['date'], row['amount'], cat)

                if has_merchant and normalized not in normalized_merchants:
                    normalized_merchants[normalized] = cat
                    newly_learned_merchants.append((normalized, cat))

        print(
            f"  [merchant diagnostic] batch summary: {batch_has_merchant_count}/{batch_total_count} "
            f"items had a usable merchant, {len(newly_learned_merchants)} newly learned",
            file=sys.stderr,
        )
        add_merchants_batch(conn, newly_learned_merchants)
    if global_cache.dirty:
        global_cache.save()
    if personal_cache.dirty:
        personal_cache.save()

    result = []
    for txn in pending_transactions:
        desc = txn['description']

        if desc in category_by_description:
            category = category_by_description[desc]
        elif desc in failed_descriptions:
            category = 'FAILED - rerun'
        elif desc in ambiguous_descriptions:
            category = NEEDS_MANUAL_REVIEW
        else:
            category = 'FAILED - rerun'

        result.append({
            'id': txn.get('id'),
            'date': txn['date'],
            'description': txn['description'],
            'amount': float(txn['amount']),
            'category': category,
        })

    return result