"""
categorization/helpers.py

Small, pure, stateless helper functions shared across multiple
categorization tiers. Nothing here holds state or talks to the
database directly - these just reshape/derive data that the tier
functions (exact_tier.py, merchant_tier.py, similarity_tier.py,
llm_tier.py) all need in the same form.
"""

from checkingName import NEEDS_MANUAL_REVIEW


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


def build_result_rows(transactions, category_by_description, ambiguous_descriptions=(), personal_cache=None, global_cache=None):
    """Shared by all three cache-tier phase functions - builds the
    final per-transaction result list in the same {id, date,
    description, amount, category} shape the frontend/
    update_transaction_categories already expect. Anything not in
    category_by_description and not ambiguous is reported as
    'PENDING_LLM' - reused as the generic "not yet resolved by ANY
    tier" sentinel across all three phases; which phase just ran (and
    therefore what "still pending" means next - the next cache phase,
    or the LLM) is tracked by the CALLER (the frontend), not encoded in
    the value itself.
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