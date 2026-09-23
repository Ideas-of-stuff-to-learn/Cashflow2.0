"""
matching/merchants/matcher.py

The actual merchant-matching algorithms - exact substring (via the
Aho-Corasick automaton) and fuzzy fallback (via the word-overlap index
+ rapidfuzz), for both a single description and a whole batch at once.
"""

import numpy as np
from rapidfuzz import fuzz, process

from ..fuzzy_index import candidates_sharing_a_word
from .normalise import normalise_for_matching
from .cache_state import get_merchant_automaton, get_merchant_word_index

SIMILARITY_THRESHOLD = 85


def match_known_merchant(description, normalised_merchants, threshold=SIMILARITY_THRESHOLD):
    normalised_description = normalise_for_matching(description)

    for merchant_name, category in normalised_merchants.items():
        if merchant_name in normalised_description:
            return category

    match = process.extractOne(
        normalised_description,
        normalised_merchants.keys(),
        scorer=fuzz.partial_ratio,
        score_cutoff=threshold
    )

    if match is None:
        return None

    merchant_name, score, _ = match

    return normalised_merchants[merchant_name]


def match_known_merchants_batch(descriptions, normalised_merchants, threshold=SIMILARITY_THRESHOLD):
    """Batched replacement for calling match_known_merchant() once per
    description in a Python loop. Same threshold, same "no match ->
    absent from the result" semantics - three passes, each one only
    doing expensive work on whatever the previous pass couldn't resolve:

    Pass 1 - exact substring containment, via a pre-built Aho-Corasick
    automaton. One automaton scan per description, O(len(description))
    each, regardless of merchant count. If a description contains more
    than one merchant name as a substring (rare), the LONGEST match
    wins - a more specific signal than a short one.

    Pass 2 - for whatever pass 1 didn't resolve: a word-overlap
    pre-filter narrows the merchant list down to only names sharing at
    least one real word with the description, THEN a small
    process.extractOne() runs against just that narrowed subset.

    Pass 3 - only for descriptions with NO indexable words at all - one
    single process.cdist call across all of them against the FULL
    merchant list.

    Returns {description: category} for everything resolved by any
    pass. Descriptions resolved by none of them are simply absent.
    """
    if not descriptions or not normalised_merchants:
        return {}

    automaton = get_merchant_automaton(normalised_merchants)
    results = {}
    still_unresolved = []
    normalised_by_desc = {}

    for desc in descriptions:
        normalised_desc = normalise_for_matching(desc)
        normalised_by_desc[desc] = normalised_desc

        best_category = None
        best_len = -1
        for _end_index, (merchant_name, category) in automaton.iter(normalised_desc):
            if len(merchant_name) > best_len:
                best_len = len(merchant_name)
                best_category = category

        if best_category is not None:
            results[desc] = best_category
        else:
            still_unresolved.append(desc)

    if not still_unresolved:
        return results

    merchant_names_list, word_index, short_indices = get_merchant_word_index(normalised_merchants)
    needs_full_scan = []

    for desc in still_unresolved:
        normalised_desc = normalised_by_desc[desc]
        candidates = candidates_sharing_a_word(normalised_desc, merchant_names_list, word_index, short_indices)

        if candidates is merchant_names_list:
            needs_full_scan.append(desc)
            continue

        if not candidates:
            continue

        match = process.extractOne(
            normalised_desc, candidates, scorer=fuzz.partial_ratio, score_cutoff=threshold
        )
        if match is not None:
            merchant_name, _score, _ = match
            results[desc] = normalised_merchants[merchant_name]

    if needs_full_scan:
        normalised_queries = [normalised_by_desc[d] for d in needs_full_scan]
        scores = process.cdist(
            normalised_queries, merchant_names_list, scorer=fuzz.partial_ratio, score_cutoff=threshold
        )
        best_idx = scores.argmax(axis=1)
        best_scores = scores[np.arange(len(needs_full_scan)), best_idx]
        for i, desc in enumerate(needs_full_scan):
            if best_scores[i] >= threshold:
                merchant_name = merchant_names_list[best_idx[i]]
                results[desc] = normalised_merchants[merchant_name]

    return results