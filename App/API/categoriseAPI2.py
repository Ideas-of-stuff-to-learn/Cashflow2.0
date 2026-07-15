import os

from dotenv import load_dotenv
from google import genai

from cache import CategoryCache
from checkingName import NEEDS_MANUAL_REVIEW

# Import all reusable logic directly from categoriseAug - no rewriting needed
from categoriseAugDB import (
    categorize_batch,
    chunked,
    find_similar_cached_description,
    match_known_merchant,
    normalize_for_matching,
    load_merchants,
    add_merchant,
    load_categories,
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

def run_cache_tiers(transactions: list, user_id: str, conn) -> list:
    """Tiers 1-4 only - personal cache, global exact, merchant dict,
    similarity. Returns immediately with no LLM calls.
    Items that couldn't be resolved get category='PENDING_LLM' so the
    frontend knows to send them to the LLM tier separately.
    """
    global_cache = CategoryCache(conn, scope='global')
    personal_cache = CategoryCache(conn, scope='personal', user_id=user_id)
    global_cache.preload()
    personal_cache.preload()
    normalized_merchants = load_merchants(conn)
    # Fetched ONCE for the whole request - see the matching comment in
    # run_categorization above for why.
    global_resolved = global_cache.resolved_descriptions()
    global_resolved_lookup = list(global_resolved.keys())
    
    unique_descriptions = uniqueDescriptions(transactions)


    rows_by_description = rowsByDescription(transactions)


    category_by_description = {}
    to_query = []
    ambiguous_descriptions = set()

    for desc in unique_descriptions:

        status = combined_status(desc, personal_cache, global_cache)
        if status['status'] == 'resolved':
            category = status['category']
            if category:
                category_by_description[desc] = category
                continue
        if status['status'] in ('ambiguous', 'pending'):
            # Same fix as run_categorization - fetched once per description,
            # not once per row sharing it.
            existing_personal = {(r['date'], str(r['amount'])) for r in personal_cache.records_for(desc)}
            existing_global = {(r['date'], str(r['amount'])) for r in global_cache.records_for(desc)}
            for row in rows_by_description.get(desc, []):
                inPersonal, inGlobal = row_already_recorded(row, existing_personal, existing_global)
                if not inPersonal and not inGlobal:
                    personal_cache.add_record(desc, row['date'], row['amount'], NEEDS_MANUAL_REVIEW)
                    existing_personal.add((row['date'], str(row['amount'])))
            ambiguous_descriptions.add(desc)
            continue

        merchant_category = match_known_merchant(desc, normalized_merchants)
        if merchant_category is not None:
            category_by_description[desc] = merchant_category
            global_resolved[desc] = merchant_category
            if desc not in global_resolved_lookup:
                global_resolved_lookup.append(desc)
            for row in rows_by_description.get(desc, []):
                global_cache.add_record(desc, row['date'], row['amount'], merchant_category)
            continue

        similar_category = find_similar_cached_description(
            desc,
            global_resolved_lookup,
            global_resolved
        )
        if similar_category is not None:
            category_by_description[desc] = similar_category
            global_resolved[desc] = similar_category
            if desc not in global_resolved_lookup:
                global_resolved_lookup.append(desc)
            for row in rows_by_description.get(desc, []):
                global_cache.add_record(desc, row['date'], row['amount'], similar_category)
            continue

        to_query.append(desc)

    if global_cache.dirty:
        global_cache.save()
    if personal_cache.dirty:
        personal_cache.save()
    result = []
    for txn in transactions:
        desc = txn['description']
        if desc in category_by_description:
            category = category_by_description[desc]
        elif desc in ambiguous_descriptions:
            category = NEEDS_MANUAL_REVIEW
            for record in personal_cache.records_for(desc):
                if record['date'] == txn['date'] and str(record['amount']) == str(txn['amount']):
                    category = record['category']
                    break
            if category == NEEDS_MANUAL_REVIEW:
                for record in global_cache.records_for(desc):
                    if record['date'] == txn['date'] and str(record['amount']) == str(txn['amount']):
                        category = record['category']
                        break
        elif desc in to_query:
            category = 'PENDING_LLM'
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


def run_llm_tier(pending_transactions: list, user_id: str, conn, batch_size: int = 200) -> list:
    """Tier 5 only - LLM categorisation for transactions that couldn't
    be resolved by cache tiers. Accepts only the PENDING_LLM transactions
    from run_cache_tiers(), never re-runs the cache checks.
    """
    if not pending_transactions:
        return []

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
        cats = categorize_batch(client, batch, DEFAULT_CATEGORIES)
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

                for row in rows_by_description.get(desc, []):
                    target_cache.add_record(desc, row['date'], row['amount'], cat)

                if has_merchant and normalized not in normalized_merchants:
                    normalized_merchants[normalized] = cat
                    add_merchant(conn,normalized,cat)
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