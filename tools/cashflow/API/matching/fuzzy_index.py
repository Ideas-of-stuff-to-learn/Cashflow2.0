"""
matching/fuzzy_index.py

Character n-gram/word-overlap indexing shared by both merchant fuzzy
matching (merchants.py) and cached-description similarity matching
(similarity.py). Neither of those files needs to know how this
indexing works internally - they just call build_word_index() once
over their own candidate list, then candidates_sharing_a_word() per
query, to narrow the field before running an expensive fuzzy scorer.
"""

# n-gram size for the candidate-generation index below. 3 (trigrams) is
# the standard choice for this kind of fuzzy pre-filter (the same idea
# Postgres's pg_trgm extension is built on) - long enough to be
# reasonably specific, short enough that a single-character typo still
# leaves most of a string's trigrams untouched.
NGRAM_SIZE = 3

# How many of the highest-trigram-overlap candidates to actually
# fuzzy-score. Bounds the cost of the fuzzy step even in the rare case
# a query shares SOME trigram with a large number of candidates (a
# common short fragment) - only the most-plausible handful get the
# expensive scorer run against them, not everything that shares even
# one trigram.
NGRAM_TOP_K = 40

# Candidates at or below this length are ALWAYS included in the fuzzy-
# scoring pool, regardless of n-gram overlap with the query - a single
# deletion near the start of a short string (e.g. "tesco" -> "teco")
# shifts every character after it, which can wipe out EVERY shared
# trigram even though the strings are obviously the same thing with one
# typo. Trigram overlap is only a reliable signal once a string is long
# enough that one deletion can't plausibly destroy all of it. The count
# of genuinely short merchant names / descriptions stays naturally
# small and roughly constant over time (there are only so many short
# brand names in existence) even as the OVERALL merchant table grows
# into the thousands, so always-including them doesn't reintroduce the
# O(M) growth problem this filter exists to avoid.
SHORT_CANDIDATE_LENGTH = 6


def _ngrams(text):
    """Character n-grams of a normalized string. Strings shorter than
    NGRAM_SIZE fall back to the whole string as a single token, so even
    a very short merchant name still gets indexed at all."""
    if len(text) < NGRAM_SIZE:
        return {text} if text else set()
    return {text[i:i + NGRAM_SIZE] for i in range(len(text) - NGRAM_SIZE + 1)}


def build_word_index(candidate_list):
    """candidate_list: a list of already-normalized strings (merchant
    names, or resolved global descriptions). Returns (index,
    short_indices):
    - index: {ngram: set(indices into candidate_list)} - lets "which
      candidates share the most character-level substrings with this
      query" be answered via a handful of dict lookups + a tally,
      instead of a full scan of candidate_list.
    - short_indices: set of indices whose candidate is at or under
      SHORT_CANDIDATE_LENGTH - see that constant's comment for why
      these need to bypass the n-gram filter entirely rather than rely
      on it.

    Indexes on character n-grams rather than whole words specifically
    so a typo affecting a description's ONLY word (e.g. "netflix" ->
    "netfflix") still surfaces its true match - whole-word overlap
    would find nothing in common between those two strings at all,
    since the typo corrupts the only word present.
    """
    index = {}
    short_indices = set()
    for i, text in enumerate(candidate_list):
        if len(text) <= SHORT_CANDIDATE_LENGTH:
            short_indices.add(i)
        for gram in _ngrams(text):
            index.setdefault(gram, set()).add(i)
    return index, short_indices


def candidates_sharing_a_word(query_text, candidate_list, index, short_indices, top_k=NGRAM_TOP_K):
    """Returns the (small, in the common case) subset of candidate_list
    most likely to contain the true best fuzzy match for query_text:
    the top `top_k` candidates ranked by an IDF-weighted trigram
    overlap score, UNION every candidate at or under
    SHORT_CANDIDATE_LENGTH (always included regardless of ranking -
    see that constant's comment for why trigram overlap alone isn't
    reliable for short strings under a deletion).

    Weighted, not just counted, for a reason found directly through
    testing: with a raw overlap COUNT, a trigram shared by almost every
    candidate (e.g. common boilerplate text most descriptions in a
    cluster share, differing only in a trailing reference number)
    contributes exactly as much to the ranking as a trigram only a
    handful of candidates share - so the boilerplate trigrams can
    completely swamp the few genuinely discriminating ones, and the
    TRUE best match can get ranked outside the top_k entirely even
    though its real fuzzy-ratio score is highest. Weighting each
    trigram's contribution by 1/(number of candidates containing it) -
    the same idea as TF-IDF's rarity weighting in text search - fixes
    this: a trigram present in nearly all candidates contributes almost
    nothing, while a rare, discriminating trigram contributes a lot.

    Falls back to the FULL candidate_list if the query has no n-grams
    at all (only possible for an empty string) - nothing meaningful to
    filter on, so nothing gets excluded.
    """
    grams = _ngrams(query_text)
    if not grams:
        return candidate_list

    overlap_scores = {}
    for gram in grams:
        matching_indices = index.get(gram, ())
        if not matching_indices:
            continue
        weight = 1.0 / len(matching_indices)
        for idx in matching_indices:
            overlap_scores[idx] = overlap_scores.get(idx, 0.0) + weight

    ranked = sorted(overlap_scores.items(), key=lambda pair: pair[1], reverse=True)
    top_indices = {idx for idx, _score in ranked[:top_k]}
    combined_indices = top_indices | short_indices

    if not combined_indices:
        return []

    return [candidate_list[i] for i in combined_indices]