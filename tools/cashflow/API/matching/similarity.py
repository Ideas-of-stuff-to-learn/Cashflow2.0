"""
matching/similarity.py

Fuzzy matching against the global cache's own already-resolved
description history - distinct from merchant matching (matching/
merchants/), since this has no substring/dictionary step at all, just
whole-string similarity.
"""

import numpy as np
from rapidfuzz import fuzz, process

from .fuzzy_index import build_word_index, candidates_sharing_a_word

SIMILARITY_THRESHOLD = 85


def find_similar_cached_description(
    description,
    resolved_lookup,
    resolved_categories,
    threshold=SIMILARITY_THRESHOLD
):
    if not resolved_lookup:
        return None

    match = process.extractOne(
        description,
        resolved_lookup,
        scorer=fuzz.ratio,
        score_cutoff=threshold
    )

    if match is None:
        return None

    matched_description, score, _ = match

    return resolved_categories[matched_description]


def find_similar_cached_descriptions_batch(descriptions, resolved_lookup, resolved_categories, threshold=SIMILARITY_THRESHOLD):
    """Batched replacement for calling find_similar_cached_description()
    once per description - against the GLOBAL CACHE's already-resolved
    descriptions (not merchants - this tier has nothing to do with the
    merchants table). Same word-overlap pre-filter strategy as the
    merchant tier's fuzzy fallback.

    A fresh word index is built over resolved_lookup on every call (NOT
    cached at process level, unlike the merchant word index) - this
    list changes essentially every request as new descriptions get
    resolved, whereas merchants change rarely. Building the index
    itself is cheap (O(sum of description lengths), a single pass with
    no fuzzy comparisons at all) compared to the O(N x M) fuzzy scan it
    replaces, so rebuilding it fresh every call is the right tradeoff
    here, not a missed caching opportunity.

    There's no substring/Aho-Corasick pass here, unlike the merchant
    tier - this tier is fuzzy-similarity-only from the start
    (fuzz.ratio, whole-string edit distance), so there's no exact-
    substring sub-problem to speed up separately; the word-overlap
    filter is what narrows the field before the real fuzzy scoring runs.

    Returns {description: category} for everything that cleared the
    threshold. Descriptions with no sufficiently similar match are
    simply absent from the result.
    """
    if not descriptions or not resolved_lookup:
        return {}

    word_index, short_indices = build_word_index(resolved_lookup)
    results = {}
    needs_full_scan = []

    for desc in descriptions:
        candidates = candidates_sharing_a_word(desc, resolved_lookup, word_index, short_indices)

        if candidates is resolved_lookup:
            needs_full_scan.append(desc)
            continue

        if not candidates:
            continue

        match = process.extractOne(desc, candidates, scorer=fuzz.ratio, score_cutoff=threshold)
        if match is not None:
            matched_description, _score, _ = match
            results[desc] = resolved_categories[matched_description]

    if needs_full_scan:
        scores = process.cdist(needs_full_scan, resolved_lookup, scorer=fuzz.ratio, score_cutoff=threshold)
        best_idx = scores.argmax(axis=1)
        best_scores = scores[np.arange(len(needs_full_scan)), best_idx]
        for i, desc in enumerate(needs_full_scan):
            if best_scores[i] >= threshold:
                matched_description = resolved_lookup[best_idx[i]]
                results[desc] = resolved_categories[matched_description]

    return results