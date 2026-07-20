"""
Tasks to be done next
Create a link to share with mum and dad
Partial batch retrying (1-2hrs) DONE
Will try adding a normalisation and similarity detection instead of perfect exact detection (3-5 hrs)
Research how long convert to app process will take , advice on caveats: IOS, Android or Both 
Deploying app
Process
Costs
Competitors research
Spendee as an example
Features I like
Will try convert to a database format (4-6 hrs)
Engineering report

"""
 
import argparse
import csv
import json
import os
import sys
import time
import numpy as np
import ahocorasick
from rapidfuzz import fuzz, process
from psycopg2.extras import execute_values

from google import genai
from google.genai import errors as genai_errors
 
from cache import CategoryCache
from database import get_connection, release_connection
from checkingName import NEEDS_MANUAL_REVIEW
from dotenv import load_dotenv
load_dotenv()

# Categories the LLM is told to use for things that genuinely need YOUR
# judgement (e.g. it's clearly a real purchase, but only you know what it
# actually was for). After all API calls finish, main() will interactively
# ask you to resolve any description still sitting at this value.
 
MODEL_NAME = "gemini-2.5-flash"
SIMILARITY_THRESHOLD = 85

# Tried, in order, ONLY when the primary model itself returns a
# transient server-side error (429/503/504/UNAVAILABLE/
# DEADLINE_EXCEEDED - see categorize_batch below) - never used just
# because an individual item's category was invalid, since that's a
# signal about the ANSWER, not about which model is reachable, and
# switching models wouldn't fix it.
#
# gemini-3.1-flash-lite is Google's own currently-recommended
# migration target for exactly this kind of task (high-volume,
# latency-sensitive classification) - the 2.5 Flash-Lite line started
# returning hard 404s ("no longer available") for newer accounts in
# July 2026, well ahead of its official October 2026 shutdown date, so
# it's no longer a safe fallback choice. Use the STABLE model id here,
# not "-preview" variants - the 3.1 Flash-Lite preview was itself
# already shut down in May 2026, a reminder that preview models can
# disappear with little warning even when the stable release is fine.
#
# Google deprecates/renames models on this kind of short notice
# regularly - worth checking this is still current in Google AI Studio
# occasionally. An outdated entry here just fails with its own error
# (a 404, same as just seen) and gets skipped like any other failure -
# it won't silently break anything, just won't help until updated.
FALLBACK_MODELS = ["gemini-3.1-flash-lite"]

# The genai SDK does NOT set any timeout on its HTTP calls by default -
# a slow/hanging Gemini response just blocks the request indefinitely.
# The only thing that ever stopped that before was gunicorn's own
# worker timeout (120s, set via Render's Start Command) - killing the
# whole worker with SIGKILL, which is a much worse failure than a
# normal caught exception: it can leave the DB connection pool in a
# bad state (we've seen "SSL error: decryption failed or bad record
# mac" on the very next request right after one of these), and Flask
# never gets a chance to roll back the transaction or return a proper
# error response at all.
#
# This deadline is now controlled from the frontend - see
# GEMINI_REQUEST_TIMEOUT_MS in useFileProcessor.js, sent as
# gemini_timeout_ms on the /categorize/llm request, threaded through
# categorize_llm (backend.py) -> run_llm_tier -> here. That's the
# number to actually change. DEFAULT_GEMINI_REQUEST_TIMEOUT_MS below is
# only a fallback for anything that calls categorize_batch() without
# specifying one (e.g. running categoriseAugDB.py directly as a
# script) - keep it in the same safe ballpark as whatever the frontend
# is set to.
DEFAULT_GEMINI_REQUEST_TIMEOUT_MS = 30000

# Shared across every request in this worker process, same reasoning as
# _global_records_cache in cache.py: the merchants table is the same
# data no matter who's asking, and used to be reloaded and
# re-normalized from scratch on every single request. None is the
# "never loaded yet" sentinel (a real empty dict is a valid loaded
# state, so it can't double as that signal).
_global_merchants_cache = None

# Aho-Corasick automaton over every merchant name, built once per
# worker process (same lifecycle as _global_merchants_cache above).
# Lets "does ANY merchant name appear inside this description" be
# answered with a single scan over the description's characters,
# instead of looping over every merchant name for every description -
# see get_merchant_automaton() below.
#
# Deliberately INVALIDATED (not live-patched) on every merchant write,
# unlike _global_merchants_cache's in-place patching in add_merchant()
# below. Adding one word to an already-built automaton means its
# failure links (the structure that makes multi-pattern matching fast)
# would need recomputing to stay correct - a full rebuild is the
# honest cost of a correct update here, not something worth a more
# complex incremental scheme for. Merchant additions are rare,
# operator-driven events (not a per-request hot path), so paying a
# rebuild the next time the automaton is actually needed is the right
# tradeoff, not a performance concern.
_global_merchant_automaton_cache = None


def get_merchant_automaton(normalized_merchants: dict):
    """Builds (once, cached at process level) an Aho-Corasick automaton
    over every merchant name -> (name, category) pair. See the module-
    level comment on _global_merchant_automaton_cache above for the
    caching/invalidation reasoning.
    """
    global _global_merchant_automaton_cache
    if _global_merchant_automaton_cache is not None:
        return _global_merchant_automaton_cache

    automaton = ahocorasick.Automaton()
    for merchant_name, category in normalized_merchants.items():
        if merchant_name:  # guard against an empty normalized name
            automaton.add_word(merchant_name, (merchant_name, category))
    automaton.make_automaton()
    _global_merchant_automaton_cache = automaton
    print(
        f"[merchant automaton] COLD BUILD: {len(normalized_merchants)} merchant name(s)",
        flush=True,
    )
    return automaton


def invalidate_merchant_automaton():
    """Called whenever the merchant dictionary changes (add_merchant) -
    forces the next get_merchant_automaton() / get_merchant_word_index()
    call to rebuild from the current (already-patched)
    _global_merchants_cache."""
    global _global_merchant_automaton_cache, _global_merchant_word_index_cache
    _global_merchant_automaton_cache = None
    _global_merchant_word_index_cache = None


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


def _ngrams(text):
    """Character n-grams of a normalized string. Strings shorter than
    NGRAM_SIZE fall back to the whole string as a single token, so even
    a very short merchant name still gets indexed at all."""
    if len(text) < NGRAM_SIZE:
        return {text} if text else set()
    return {text[i:i + NGRAM_SIZE] for i in range(len(text) - NGRAM_SIZE + 1)}


# Candidates at or below this length are ALWAYS included in the fuzzy-
# scoring pool, regardless of n-gram overlap with the query - see the
# comment on candidates_sharing_a_word() below for why: a single
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


# (merchant_names_list, word_index, short_indices) tuple, cached
# alongside the automaton above - same lifecycle, same invalidation
# trigger (add_merchant, via invalidate_merchant_automaton).
_global_merchant_word_index_cache = None


def get_merchant_word_index(normalized_merchants: dict):
    global _global_merchant_word_index_cache
    if _global_merchant_word_index_cache is not None:
        return _global_merchant_word_index_cache

    merchant_names_list = list(normalized_merchants.keys())
    word_index, short_indices = build_word_index(merchant_names_list)
    _global_merchant_word_index_cache = (merchant_names_list, word_index, short_indices)
    return _global_merchant_word_index_cache


def load_merchants(conn) -> dict:
    """Load the full merchant dictionary from the merchants table.
    Returns an empty dict if the table has no rows yet.

    Cached at the process level (see _global_merchants_cache above) -
    only actually queries Postgres and re-normalizes every name once
    per worker process; every call after that reuses the same dict.
    add_merchant() keeps this in sync when new merchants are learned,
    so it never goes stale during normal operation.
    """
    global _global_merchants_cache
    if _global_merchants_cache is not None:
        print(
            f"[load_merchants] WARM: reusing in-memory merchants cache "
            f"({len(_global_merchants_cache)} merchants) - no DB reload",
            flush=True,
        )
        return _global_merchants_cache

    with conn.cursor() as cur:
        cur.execute("SELECT normalized_name, category FROM merchants")
        merchants =  dict(cur.fetchall())
        normalized_merchants = {
            normalize_for_matching(name): category
            for name, category in merchants.items()
        }
    _global_merchants_cache = normalized_merchants
    print(
        f"[load_merchants] COLD LOAD: fetched merchants table from "
        f"Postgres ({len(normalized_merchants)} merchants)",
        flush=True,
    )
    return _global_merchants_cache
def load_categories(conn) -> list:
    """Returns every user-facing category name, in display order.
    Deliberately does NOT include the MANUALLY CATEGORISE sentinel..."""
    with conn.cursor() as cur:
        cur.execute("SELECT name FROM categories ORDER BY display_order")
        return [row[0] for row in cur.fetchall()]
def add_merchant(conn, normalized_name: str, category: str) -> None:
    """Insert or update a single merchant entry and commit immediately.
    Merchant-learning is a small, standalone write - not worth batching
    into the same transaction as the surrounding categorization work,
    since it should persist even if something later in the request fails.

    Also updates the process-level cache (see load_merchants above) in
    place, so the newly learned merchant is usable immediately by this
    same process without waiting for a reload.

    Kept for any single-merchant call site (e.g. an admin CLI action
    adding one merchant by hand) - run_llm_tier (categoriseAPI2.py)
    uses add_merchants_batch() below instead, for the same "many
    individual round trips" reason update_transaction_categories and
    CategoryCache.save() did.
    """
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO merchants (normalized_name, category)
               VALUES (%s, %s)
               ON CONFLICT (normalized_name) DO UPDATE SET category = EXCLUDED.category""",
            (normalized_name, category),
        )
    conn.commit()

    global _global_merchants_cache
    if _global_merchants_cache is not None:
        _global_merchants_cache[normalized_name] = category
    invalidate_merchant_automaton()


def add_merchants_batch(conn, pairs) -> None:
    """Batched replacement for calling add_merchant() once per newly-
    learned merchant. `pairs` is a list of (normalized_name, category)
    tuples. One execute_values call + one commit for the WHOLE list,
    instead of one round trip per merchant - same fix, same reasoning,
    as update_transaction_categories (shared.py) and CategoryCache.save()
    (cache.py): a from-scratch categorization run can learn hundreds of
    merchants in one request, and add_merchant()'s per-item commit is
    exactly the kind of cost that scales badly with volume.

    Deliberately called once per GEMINI BATCH inside run_llm_tier, not
    once for the entire request - this keeps most of add_merchant()'s
    original "persist even if something later fails" property: if the
    request dies partway through a large multi-batch run, every
    already-completed batch's merchants are still safely committed:
    only the batch that was in-flight at the moment of failure could
    lose its newly-learned merchants, not everything learned so far.
    """
    if not pairs:
        return

    with conn.cursor() as cur:
        execute_values(
            cur,
            """INSERT INTO merchants (normalized_name, category)
               VALUES %s
               ON CONFLICT (normalized_name) DO UPDATE SET category = EXCLUDED.category""",
            pairs,
            template="(%s, %s)",
        )
    conn.commit()

    global _global_merchants_cache
    if _global_merchants_cache is not None:
        for normalized_name, category in pairs:
            _global_merchants_cache[normalized_name] = category
    invalidate_merchant_automaton()


def patch_merchants_category_rename(old_name, new_name):
    """Live-update every cached merchant's category string in place,
    instead of discarding the whole cache and paying for a full
    Postgres reload on the next request that needs it. Used right
    after a category rename has already been committed to the DB via
    raw SQL (see update_category() in backend.py) - this brings the
    in-memory copy in sync with that same change, cheaply, without a
    round trip.
    """
    global _global_merchants_cache
    if _global_merchants_cache is None:
        return
    for merchant_name, category in _global_merchants_cache.items():
        if category == old_name:
            _global_merchants_cache[merchant_name] = new_name
        
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
 
def normalize_for_matching(text):
    """Lowercase and strip everything except letters/digits/spaces, so both
    a merchant dictionary key and a real transaction description normalize
    to the same comparable form regardless of apostrophes, punctuation, or
    case. e.g. "Sainsbury's" and "SAINSBURYS S MKTS )))" both become
    sequences of plain lowercase words that can be safely substring-matched.

    Apostrophes are REMOVED entirely (not turned into spaces/word breaks).
    Real bank descriptions render an apostrophe inconsistently - sometimes
    dropped ("SAINSBURYS"), sometimes rendered as a literal space
    ("DOMINO S PIZZA", from "Domino's Pizza") - so two things happen:
        1. Apostrophes in the input are removed before any other processing,
            so "Sainsbury's" -> "sainsburys" (one word, no gap).
        2. A standalone single-letter "word" left over after splitting on
            whitespace gets MERGED INTO the word right before it (not just
            deleted) - this is almost always the leftover "s" from a bank
            rendering an apostrophe-s as a literal space rather than dropping
            it. "domino s pizza" must become "dominos pizza" (glued back
            together), not "domino pizza" (which would no longer contain
            "dominos" as a substring at all).
    """
    text = text.replace("'", "").replace("\u2019", "")  # straight and curly apostrophes
    cleaned = "".join(ch if ch.isalnum() or ch.isspace() else " " for ch in text)
    raw_words = cleaned.lower().split()

    words = []
    for word in raw_words:
        if len(word) == 1 and words:
            words[-1] = words[-1] + word
        else:
            words.append(word)
    return " ".join(words)

def match_known_merchant(description, normalized_merchants, threshold=SIMILARITY_THRESHOLD):

    normalized_description = normalize_for_matching(description)

    best_score = 0
    best_category = None

    for merchant_name, category in normalized_merchants.items():

        if merchant_name in normalized_description:
            return category

    match = process.extractOne(
        normalized_description,
        normalized_merchants.keys(),
        scorer=fuzz.partial_ratio,
        score_cutoff=threshold
    )

    if match is None:
        return None

    merchant_name, score, _ = match

    return normalized_merchants[merchant_name]


def match_known_merchants_batch(descriptions, normalized_merchants, threshold=SIMILARITY_THRESHOLD):
    """Batched replacement for calling match_known_merchant() once per
    description in a Python loop. Same threshold, same "no match ->
    absent from the result" semantics - three passes, each one only
    doing expensive work on whatever the previous pass couldn't resolve:

    Pass 1 - exact substring containment, via a pre-built Aho-Corasick
    automaton (see get_merchant_automaton()). One automaton scan per
    description, O(len(description)) each, regardless of merchant
    count - this replaces looping over every merchant name for every
    description. If a description contains more than one merchant name
    as a substring (rare), the LONGEST match wins - a more specific
    signal than a short one. The original loop instead returned
    whichever merchant happened to be checked first (dict insertion
    order); not expected to change outcomes in practice.

    Pass 2 - for whatever pass 1 didn't resolve: a word-overlap
    pre-filter (see candidates_sharing_a_word()) narrows the merchant
    list down to only names sharing at least one real word with the
    description, THEN a small process.extractOne() runs against just
    that narrowed subset. This is the actual complexity fix for the
    fuzzy fallback - without it, this pass is O(M) per description
    regardless of how many merchants exist; with it, it's close to
    O(candidates sharing a word), which stays small even as the
    merchant table grows into the thousands.

    Pass 3 - only for descriptions with NO indexable words at all (so
    pass 2's filter had nothing to narrow down and returned everything)
    - one single process.cdist call across all of them against the
    FULL merchant list. Rare in practice (real descriptions almost
    always have at least one word of useful length), but a real
    fallback so nothing is silently skipped.

    Returns {description: category} for everything resolved by any
    pass. Descriptions resolved by none of them are simply absent.
    """
    if not descriptions or not normalized_merchants:
        return {}

    automaton = get_merchant_automaton(normalized_merchants)
    results = {}
    still_unresolved = []
    normalized_by_desc = {}

    # Pass 1 - exact substring, via Aho-Corasick.
    for desc in descriptions:
        normalized_desc = normalize_for_matching(desc)
        normalized_by_desc[desc] = normalized_desc

        best_category = None
        best_len = -1
        for _end_index, (merchant_name, category) in automaton.iter(normalized_desc):
            if len(merchant_name) > best_len:
                best_len = len(merchant_name)
                best_category = category

        if best_category is not None:
            results[desc] = best_category
        else:
            still_unresolved.append(desc)

    if not still_unresolved:
        return results

    # Pass 2 - word-filtered fuzzy match, one small extractOne per
    # description against ONLY the candidates sharing a word with it.
    merchant_names_list, word_index, short_indices = get_merchant_word_index(normalized_merchants)
    needs_full_scan = []

    for desc in still_unresolved:
        normalized_desc = normalized_by_desc[desc]
        candidates = candidates_sharing_a_word(normalized_desc, merchant_names_list, word_index, short_indices)

        if candidates is merchant_names_list:
            # No indexable words in this description - the filter had
            # nothing to narrow down, defer to the Pass 3 batch fallback
            # below rather than paying the full scan here per-item.
            needs_full_scan.append(desc)
            continue

        if not candidates:
            continue  # shares no word with anything - genuinely no match

        match = process.extractOne(
            normalized_desc, candidates, scorer=fuzz.partial_ratio, score_cutoff=threshold
        )
        if match is not None:
            merchant_name, _score, _ = match
            results[desc] = normalized_merchants[merchant_name]

    # Pass 3 - rare fallback: descriptions with no indexable words at
    # all, batched together against the full merchant list via cdist
    # (there's no per-query filtering to do here, so a fixed shared
    # choices list across all of them is exactly what cdist is for).
    if needs_full_scan:
        normalized_queries = [normalized_by_desc[d] for d in needs_full_scan]
        scores = process.cdist(
            normalized_queries, merchant_names_list, scorer=fuzz.partial_ratio, score_cutoff=threshold
        )
        best_idx = scores.argmax(axis=1)
        best_scores = scores[np.arange(len(needs_full_scan)), best_idx]
        for i, desc in enumerate(needs_full_scan):
            if best_scores[i] >= threshold:
                merchant_name = merchant_names_list[best_idx[i]]
                results[desc] = normalized_merchants[merchant_name]

    return results


def find_similar_cached_descriptions_batch(descriptions, resolved_lookup, resolved_categories, threshold=SIMILARITY_THRESHOLD):
    """Batched replacement for calling find_similar_cached_description()
    once per description - against the GLOBAL CACHE's already-resolved
    descriptions (not merchants - this tier has nothing to do with the
    merchants table). Same word-overlap pre-filter strategy as the
    merchant tier's fuzzy fallback above:

    A fresh word index is built over resolved_lookup on every call
    (NOT cached at process level, unlike the merchant word index) -
    this list changes essentially every request as new descriptions get
    resolved, whereas merchants change rarely. Building the index itself
    is cheap (O(sum of description lengths), a single pass with no
    fuzzy comparisons at all) compared to the O(N x M) fuzzy scan it
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


def build_prompt(transactions, categories):
    """Build a single prompt asking the model to categorize a batch of transactions.
 
    Each transaction dict can optionally include "previous_invalid_category"
    - if present, the prompt tells the model exactly what it answered last
    time that was rejected, so it can self-correct (e.g. a truncated or
    mangled category name) instead of blindly re-guessing from scratch.
    """
    category_list = ", ".join(categories)
    # Only the description matters for categorization - that's all we ever
    # send (transactions here are deduplicated-by-description pseudo-entries,
    # not full transaction records).
    rows = []
    any_feedback = False
    for i, t in enumerate(transactions):
        row = {"id": i, "description": t["description"]}
        prev = t.get("previous_invalid_category")
        if prev:
            row["your_previous_answer_was_rejected"] = prev
            any_feedback = True
        rows.append(row)
 
    feedback_note = ""
    if any_feedback:
        feedback_note = (
            "\nSome items below include "
            '"your_previous_answer_was_rejected" - that was YOUR answer last '
            "time, and it was rejected because it did not EXACTLY match one "
            "of the allowed categories (e.g. it may have been truncated or "
            "slightly misspelled). Look at the allowed categories list "
            "again carefully and give the exact, full, correctly-spelled "
            "category string this time.\n"
        )
 
    prompt = f"""You are categorizing bank transactions for a personal budgeting app.
 
                Allowed categories (use EXACTLY one of these per transaction, verbatim):
                {category_list}
                {feedback_note}
                Transactions (JSON array):
                {json.dumps(rows, indent=2)}
                Return ONLY a JSON array, no other text, no markdown code fences.
                Each element must be: {{"id": <int>, "category": "<one of the allowed categories>", "merchant": "<merchant name or null>"}}
                The array must have exactly {len(rows)} elements, one per transaction, in the same order.

                For "merchant": extract ONLY the core merchant/business name from the description, ignoring noise like store numbers, branch codes, cities, and bank suffixes (e.g. ")))", "VIS", "BP", "CR"). 
                Examples:
                - "TESCO STORES 6636 BIRMINGHAM )))" -> "tesco"
                - "NETFLIX.COM" -> "netflix"  
                - "FASTER PAYMENT REF 7749283" -> null (no real merchant)
                - "UBER *TRIP HELP.UBER.COM VIS" -> "uber"
                - "SAINSBURYS S MKTS SELLY OAK )))" -> "sainsburys"
                Return null if there is no identifiable merchant (e.g. bank transfers, salary payments with reference numbers only) or if you just can't find it or are confused. 
            """
    return prompt
 
def categorize_batch(client, transactions, categories, max_retries=3, gemini_timeout_ms=DEFAULT_GEMINI_REQUEST_TIMEOUT_MS, models_to_try=None):
    """Send a batch to Gemini and parse the JSON response. Retries ONLY the
    specific items that failed validation or parsing - not the whole batch -
    so a single bad/mangled category from the model doesn't force re-asking
    about everything else that was already answered correctly.

    models_to_try defaults to [MODEL_NAME] + FALLBACK_MODELS. Attempt
    number N (0-indexed) uses models_to_try[min(N, len(models_to_try)-1)]
    - i.e. the primary model gets attempt 0, then every attempt after a
    transient failure moves on to (and stays on) the next model in the
    list. Deliberately does NOT multiply the total number of attempts
    by the number of models - max_retries stays the same total budget
    either way, just distributed across models instead of retrying the
    same overloaded one repeatedly. Keeps worst-case total time
    unchanged from before this existed (still bounded by
    max_retries * gemini_timeout_ms + backoff, same math as
    GEMINI_REQUEST_TIMEOUT_MS's docstring in useFileProcessor.js).

    Returns a list the same length as `transactions`. Each element is one of:
      - a real category string (success)
      - NEEDS_MANUAL_REVIEW (the model kept responding, but never gave a
        valid category for this item after max_retries attempts - this is
        treated as a signal the item itself is genuinely hard, same as the
        model proactively choosing NEEDS_MANUAL_REVIEW itself)
      - None (a TRANSIENT failure - rate limit, server error, or an
        unparseable whole response - exhausted retries. This is NOT cached
        by the caller, so it's retried fresh next run, since the failure
        was about the request, not the transaction.)
    """
    if models_to_try is None:
        models_to_try = [MODEL_NAME] + FALLBACK_MODELS

    allowed = set(categories)
 
    # final_results maps ORIGINAL index (position in the `transactions`
    # argument) -> confirmed-valid category string. This persists across
    # attempts, growing as items get resolved.
    final_results = {}
 
    # Items that got real responses from the model on every attempt, but
    # never a VALID category, even after max_retries. Distinct from a
    # transient failure - the model had its chances and the answer itself
    # was the problem, so these fall back to manual review rather than a
    # fresh retry next run.
    give_up_to_manual = set()
 
    # Maps ORIGINAL index -> the invalid category string the model gave
    # last time, so the NEXT attempt's prompt can tell the model exactly
    # what was rejected and ask it to self-correct, instead of blindly
    # re-asking the same question with no memory of the wrong answer.
    previous_invalid_by_index = {}
 
    # pending starts as every original index, and shrinks each attempt to
    # only the indices that still need a (re)answer.
    pending = list(range(len(transactions)))
 
    for attempt in range(max_retries):
        if not pending:
            break

        model_name = models_to_try[min(attempt, len(models_to_try) - 1)]
 
        # Build a prompt for ONLY the currently-pending items. Their ids in
        # THIS prompt are 0..len(pending)-1 (build_prompt always numbers
        # from 0) - NOT the same as their original index, so we keep a
        # local map from this attempt's id back to the original index.
        pending_transactions = []
        for i in pending:
            t = dict(transactions[i])
            if i in previous_invalid_by_index:
                t["previous_invalid_category"] = previous_invalid_by_index[i]
            pending_transactions.append(t)
        local_id_to_original_index = {
            local_id: original_index
            for local_id, original_index in enumerate(pending)
        }
        prompt = build_prompt(pending_transactions, categories)
 
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config={
                    "temperature": 0,
                    "response_mime_type": "application/json",
                    "http_options": {"timeout": gemini_timeout_ms},
                    # Categorising a transaction description is plain
                    # classification, not something that benefits from
                    # extended reasoning - here that's pure overhead, not
                    # accuracy. Every observed failure has taken roughly
                    # the same ~27-30s regardless of whether the batch
                    # was 600 items or 200 - that flat, size-independent
                    # cost is the signature of thinking overhead, not
                    # genuine per-item work. thinking_budget=0 disables
                    # it, which should recover most of that latency.
                    "thinking_config": {"thinking_budget": 0},
                },
            )
            text = response.text.strip()
            results = json.loads(text)
 
            if len(results) != len(pending_transactions):
                raise ValueError(
                    f"Expected {len(pending_transactions)} results, "
                    f"got {len(results)}"
                )
 
            # Walk through this attempt's results. Anything VALID gets
            # recorded permanently in final_results and removed from
            # pending. Anything invalid (or simply missing from the
            # response) stays in pending for the next attempt - and if it
            # got an actual (just invalid) answer, remember it so the next
            # prompt can show the model what was rejected.
            still_pending = []
            for local_id in range(len(pending_transactions)):
                original_index = local_id_to_original_index[local_id]
                matching = [r for r in results if r.get("id") == local_id]

                if matching:
                    category = matching[0].get("category")
                    merchant = matching[0].get("merchant")
                else:
                    category = None
                    merchant = None

                if category in allowed:
                    final_results[original_index] = {
                        "category":category,
                        "merchant":merchant,    
                    }
                    previous_invalid_by_index.pop(original_index, None)
                else:
                    still_pending.append(original_index)
                    if category is not None:
                        previous_invalid_by_index[original_index] = category
 
            pending = still_pending
 
            if not pending:
                break
 
            if attempt < max_retries - 1:
                invalid_descriptions = [
                    transactions[i]["description"] for i in pending
                ]
                print(
                    f"  {len(pending)} item(s) got an invalid/missing category, "
                    f"retrying just those: {invalid_descriptions}",
                    file=sys.stderr,
                )
                time.sleep(2)
                continue
            # Exhausted retries with some items still unresolved. The model
            # DID respond every time - it just never gave a valid category
            # for these specific items. That's a signal the item itself is
            # genuinely hard, not a transient request problem - fall back
            # to manual review rather than a fresh LLM retry next run.
            give_up_to_manual.update(pending)
            print(
                f"  Giving up on {len(pending)} item(s) after {max_retries} "
                f"attempts (model never gave a valid category) - falling back "
                f"to manual review: "
                f"{[transactions[i]['description'] for i in pending]}",
                file=sys.stderr,
            )
            pending = []
            break
 
        except (genai_errors.ClientError, genai_errors.ServerError) as e:
            # 429 = rate limited (too many requests).
            # 503 = server temporarily overloaded on Google's end.
            # 504 = Gemini's own gateway gave up before finishing (this
            # is DIFFERENT from GEMINI_REQUEST_TIMEOUT_MS/CLIENT_TIMEOUT_MS
            # in useFileProcessor.js - those are timeouts WE impose;
            # this is Google's own infrastructure timing itself out and
            # telling us so with an actual error response).
            # 404/NOT_FOUND = the model itself has been deprecated/
            # removed - genuinely happened in production (gemini-2.5-
            # flash-lite started 404ing for newer accounts in July 2026,
            # months ahead of its officially announced shutdown date).
            # Not "transient" in the retry-the-same-model sense, but
            # from the model-fallback perspective it's the same actionable
            # signal as an overload: stop using this model, try the next
            # one in models_to_try. Treating it as retryable is what
            # actually lets that switch happen instead of failing hard
            # the moment one entry in the fallback chain goes stale.
            # All of these affect the WHOLE request (it never reached
            # a working model), so everything currently pending stays
            # pending for the retry.
            is_retryable = (
                "429" in str(e)
                or "503" in str(e)
                or "504" in str(e)
                or "404" in str(e)
                or "UNAVAILABLE" in str(e)
                or "DEADLINE_EXCEEDED" in str(e)
                or "NOT_FOUND" in str(e)
            )
            if is_retryable and attempt < max_retries - 1:
                next_model = models_to_try[min(attempt + 1, len(models_to_try) - 1)]
                wait = 2 ** (attempt + 1)
                if next_model != model_name:
                    print(f"  {model_name} temporarily unavailable ({e.__class__.__name__}) - switching to {next_model}, waiting {wait}s before retry...", file=sys.stderr)
                else:
                    print(f"  API temporarily unavailable ({e.__class__.__name__}), waiting {wait}s before retry...", file=sys.stderr)
                time.sleep(wait)
                continue
            if is_retryable:
                models_actually_tried = sorted({models_to_try[min(a, len(models_to_try) - 1)] for a in range(max_retries)})
                print(
                    f"  Still unavailable after {max_retries} attempts across "
                    f"{len(models_actually_tried)} model(s) ({', '.join(models_actually_tried)}). "
                    f"Skipping {len(pending)} item(s) for now - rerun the "
                    f"script later to re-attempt these: {e}",
                    file=sys.stderr,
                )
                break
            # Not a transient error (e.g. bad API key, invalid request) -
            # retrying won't help, so fail loudly instead of hiding it.
            raise
        except (json.JSONDecodeError, ValueError) as e:
            # The WHOLE response for this attempt couldn't be parsed at
            # all (not an individual-item problem) - everything currently
            # pending stays pending for the retry.
            if attempt < max_retries - 1:
                print(f"  Couldn't parse response, retrying... ({e})", file=sys.stderr)
                time.sleep(2)
                continue
            give_up_to_manual.update(pending)
            print(
                f"  Giving up on {len(pending)} item(s) after {max_retries} "
                f"attempts (response unparseable): {e}",
                file=sys.stderr,
            )
            pending = []
            break
 
    # Assemble the final per-item result list in ORIGINAL order:
    # - a real category if it was successfully resolved
    # - NEEDS_MANUAL_REVIEW if the model responded but never gave a valid
    #   answer for it after max_retries
    # - None if it never got a real chance at all (transient request-level
    #   failure - rate limit, server error, or unparseable response)
    result = []
    for i in range(len(transactions)):
        if i in final_results:
            result.append(final_results[i])
        elif i in give_up_to_manual:
            result.append({"category": NEEDS_MANUAL_REVIEW, "merchant": None})
        else:
            result.append(None)
    return result
 
 
def chunked(items, size):
    for i in range(0, len(items), size):
        yield items[i : i + size]
 
 
def resolve_manual_review(ambiguous_descriptions, cache, categories, cache_save_callback):
    """Interactively ask the user to pick a category for EVERY individual
    transaction row still pending under an ambiguous/pending description.
 
    Unlike a normal cache lookup, ambiguous descriptions cannot be resolved
    once-per-description, because the same description has proven to mean
    different things on different occasions - so each row gets its own
    question, with its own date and amount as context, and its own answer.
 
    Saves to disk after EVERY single answer (not batched at the end) - if
    the user kills the program partway through, already-answered rows are
    safely persisted, and only the not-yet-asked rows remain pending to be
    asked again next run.
 
    Returns the number of rows resolved in this run.
    """
    # Collect every still-pending row across all ambiguous descriptions.
    pending = []  # list of (description, record_dict)
    for desc in sorted(ambiguous_descriptions):
        for record in cache.pending_records(desc):
            pending.append((desc, record))
 
    if not pending:
        return 0
 
    choosable = [c for c in categories if c != NEEDS_MANUAL_REVIEW]
 
    print(
        f"\n{len(pending)} individual transaction(s) need your input "
        f"(same description can mean different things, so each is asked "
        f"separately):\n"
    )
 
    resolved = 0
    for desc, record in pending:
        print(f"  Description: {desc}")
        print(f"  Date:   {record['date']}")
        print(f"  Amount: {record['amount']}")
        print("  Choose a category:")
        for i, cat in enumerate(choosable, start=1):
            print(f"    {i}. {cat}")
        print("    0. Skip for now (ask again next run)")
 
        while True:
            try:
                choice = input(f"  Enter a number (0-{len(choosable)}): ").strip()
            except EOFError:
                # Input stream closed unexpectedly (e.g. piped input ran
                # out, or terminal closed) - treat exactly like a skip,
                # don't crash. Already-resolved rows before this point are
                # already saved.
                choice = "0"
 
            if choice == "0":
                chosen_category = None
                break
            if choice.isdigit() and 1 <= int(choice) <= len(choosable):
                chosen_category = choosable[int(choice) - 1]
                break
            print("  Not a valid choice, try again.")
 
        if chosen_category is not None:
            cache.resolve_record(desc, record["date"], record["amount"], chosen_category)
            resolved += 1
            # Save immediately - crash-safety. A kill (Ctrl+C, closed
            # terminal) after this point loses nothing already answered.
            cache_save_callback()
            print(f"  -> Saved as '{chosen_category}'.\n")
        else:
            print("  -> Skipped, will ask again next run.\n")
 
    return resolved
 
 
def main():
    parser = argparse.ArgumentParser(description="Categorize bank transactions using Gemini.")
    parser.add_argument("input_csv", help="Path to input CSV with columns: date,description,amount")
    parser.add_argument("output_csv", help="Path to write the categorized CSV")
    parser.add_argument(
        "--batch-size",
        type=int,
        default=200,
        help="How many transactions to send per API request (default: 20)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=2.0,
        help="Seconds to wait between batches, to stay under free-tier rate limits (default: 2.0)",
    )
    args = parser.parse_args()
 
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print(
            "Error: GEMINI_API_KEY environment variable not set.\n"
            "Get a free key at https://aistudio.google.com/apikey and set it with:\n"
            '  export GEMINI_API_KEY="your-key-here"',
            file=sys.stderr,
        )
        sys.exit(1)
 
    # Your bank export has no header row - it's just date,description,amount
    # in that fixed order. We supply the column names ourselves instead of
    # reading them from the file.
    fieldnames = ["date", "description", "amount"]
    with open(args.input_csv, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f, fieldnames=fieldnames)
        transactions = list(reader)
 
    if not transactions:
        print("No transactions found in input CSV.", file=sys.stderr)
        sys.exit(1)
 
    client = genai.Client(api_key=api_key)
 
    # --- Deduplicate by description ---
    # Many transactions share the exact same description (e.g. "TESCO STORES
    # 2349 LONDON" appears every week). There's no point asking the API to
    # categorize the same description more than once - we ask it once per
    # UNIQUE description, then stamp that answer onto every transaction that
    # shares it.
    unique_descriptions = []
    seen = set()
    for t in transactions:
        desc = t["description"]
        if desc not in seen:
            seen.add(desc)
            unique_descriptions.append(desc)
 
    # --- Persistent cache (this is the part that survives across runs) ---
    # This CLI tool has no login/user concept of its own - it's a single
    # local script one person runs, so it uses one shared 'global' cache
    # rather than the personal/global split the Flask app uses per-user.
    conn = get_connection()
    cache = CategoryCache(conn, scope='global')
    print(f"Loaded {len(cache)} description group(s) from the database")

    merchants = load_merchants(conn)
    print(f"Loaded {len(merchants)} known merchant(s) from the database")
    # Group all transaction rows by description up front - needed both to
    # find genuinely new rows under an already-ambiguous description (added
    # below) and to write per-row cache records once the LLM responds.
    rows_by_description = {}
    for t in transactions:
        rows_by_description.setdefault(t["description"], []).append(t)
 
    def row_already_recorded(desc, row):
        return any(
            r["date"] == row["date"] and r["amount"] == row["amount"]
            for r in cache.records_for(desc)
        )
 
    category_by_description = {}
    to_query = []          # unique descriptions never seen - need the LLM
    ambiguous_descriptions = set()  # proven ambiguous - skip LLM, go straight to manual review
    similarity_hits = 0     # Tier 2: matched an existing resolved description closely enough
    merchant_dictionary_hits = 0 
    for desc in unique_descriptions:
        status = cache.status(desc)
        if status == "resolved":
            # Every record for this description agreed - safe to reuse.
            category_by_description[desc] = cache.resolved_category(desc)
        elif status in ("ambiguous", "pending"):
            # Cache history already proves this description can't be
            # trusted alone (or a previous manual review was left
            # incomplete) - every row needs manual review, no LLM call.
            # Any row in THIS run we haven't seen before (new date+amount)
            # needs a fresh pending placeholder created now, so
            # resolve_manual_review() has something to ask about.
            for row in rows_by_description.get(desc, []):
                if not row_already_recorded(desc, row):
                    cache.add_record(desc, row["date"], row["amount"], NEEDS_MANUAL_REVIEW)
            ambiguous_descriptions.add(desc)
        else:  # "unknown" - Tier 1 missed. Try Tier 2, then Tier 3, before the LLM.
            similar_category = find_similar_cached_description(desc, cache.resolved_descriptions())
            if similar_category is not None:
                # Tier 2 hit: this description is highly similar (>=
                # SIMILARITY_THRESHOLD) to an existing RESOLVED description
                # already in the cache - almost always a formatting-only
                # variant of something already known (e.g. a trailing
                # "VIS" vs ")))"). Treat it like a confident answer - write
                # it into the cache now so it's a normal Tier 1 hit from
                # here on.
                category_by_description[desc] = similar_category
                similarity_hits += 1
                for row in rows_by_description.get(desc, []):
                    cache.add_record(desc, row["date"], row["amount"], similar_category)
                continue
 
            merchant_category = match_known_merchant(desc,merchants)
            if merchant_category is not None:
                # Tier 3 hit: a known merchant name (e.g. "Tesco",
                # "Sainsbury's", "Dominos") appears inside this brand-new
                # description, even though it wasn't similar enough as a
                # WHOLE string to anything already cached (e.g. a
                # different branch/store number). Treat it exactly like a
                # confident LLM answer - write it into the cache now, so
                # every future run sees this as a normal Tier 1 hit and
                # never re-runs Tier 2 or Tier 3 for it again.
                category_by_description[desc] = merchant_category
                merchant_dictionary_hits += 1
                for row in rows_by_description.get(desc, []):
                    cache.add_record(desc, row["date"], row["amount"], merchant_category)
            else:
                to_query.append(desc)
 
    resolved_from_cache = (
        len(unique_descriptions) - len(to_query) - len(ambiguous_descriptions)
        - similarity_hits - merchant_dictionary_hits
    )
    print(
        f"{len(transactions)} transactions, "
        f"{len(unique_descriptions)} unique descriptions "
        f"({resolved_from_cache} exact cache hits, "
        f"{similarity_hits} matched a similar cached description (no LLM call), "
        f"{merchant_dictionary_hits} matched a known merchant (no LLM call), "
        f"{len(ambiguous_descriptions)} need manual review (no LLM call), "
        f"{len(to_query)} new - only these will hit the API)..."
    )
 
    # We only need to send "description" to the model here (amount isn't
    # needed to tell two identical descriptions apart), so build a minimal
    # list of fake "transactions" - one per NEW unique description - to
    # reuse categorize_batch() unchanged.
    pseudo_transactions = [{"description": d} for d in to_query]
 
    failed_descriptions = set()
    batches = list(chunked(pseudo_transactions, args.batch_size))
    for batch_num, batch in enumerate(batches, start=1):
        print(f"Batch {batch_num}/{len(batches)} ({len(batch)} new descriptions)...")
        cats = categorize_batch(client, batch, DEFAULT_CATEGORIES)
        for item, result in zip(batch, cats):
            desc = item["description"]
            if result is None:
                # The API gave up on this description after retries (a
                # transient server/parsing error, NOT the LLM choosing
                # NEEDS_MANUAL_REVIEW). Do NOT cache it at all, so it gets
                # asked again next run instead of being wrongly locked in.
                failed_descriptions.add(desc)
                continue
            cat = result["category"]
            merchant = result["merchant"]
            if cat == NEEDS_MANUAL_REVIEW:
                # The LLM confidently decided this needs a human. Save a
                # PENDING record for every actual row with this description
                # right now - so even if the program is closed before the
                # manual-review step runs, the LLM call is never wasted on
                # a re-ask next time.
                for row in rows_by_description.get(desc, []):
                    cache.add_record(desc, row["date"], row["amount"], NEEDS_MANUAL_REVIEW)
                ambiguous_descriptions.add(desc)
            else:
                # Confident answer - applies to every row sharing this
                # description. Write one record per row (not one shared
                # value) so future agree/disagree checks have real evidence.
                category_by_description[desc] = cat
                for row in rows_by_description.get(desc, []):
                    cache.add_record(desc, row["date"], row["amount"], cat)
                    
                if merchant and isinstance(merchant, str):
                    normalized = normalize_for_matching(merchant)
                    if len(normalized) >= 3 and cat != NEEDS_MANUAL_REVIEW:
                        if normalized not in merchants:
                            merchants[normalized] = cat
                            add_merchant(conn, normalized, cat)
                            print(f"  Learned new merchant: '{normalized}' -> '{cat}'")
        
        if batch_num < len(batches):
            time.sleep(args.delay)
 
    # Save now, BEFORE manual review starts - this persists every confident
    # LLM answer, every MANUALLY CATEGORISE pending placeholder from this
    # batch, AND any newly-added pending placeholders for brand-new rows
    # under an already-ambiguous description (added above, before the LLM
    # was ever called). Always save here rather than trying to track every
    # condition that could have changed the cache - cheap, and correctness
    # matters more than skipping one disk write.
    cache.save()
    print(f"Saved cache ({len(cache)} description group(s)) to the database")
 
    # Ask the user to resolve every individual pending transaction row
    # under an ambiguous/pending description. This saves to disk after
    # EVERY answer (via the callback), not just at the end, so a kill
    # partway through loses nothing already answered.
    manually_resolved = resolve_manual_review(
        ambiguous_descriptions, cache, DEFAULT_CATEGORIES, cache.save
    )
    if manually_resolved:
        print(f"Resolved {manually_resolved} transaction(s) manually this run.")
 
    if failed_descriptions:
        print(
            f"\nWarning: {len(failed_descriptions)} description(s) could not be "
            f"categorized (API was unavailable even after retries) and are marked "
            f"'FAILED - rerun script' in the output. Just rerun the script "
            f"to retry only these:",
            file=sys.stderr,
        )
        for d in sorted(failed_descriptions):
            print(f"  - {d}", file=sys.stderr)
 
    def category_for_row(txn):
        """Look up the right category for one specific transaction row.
        Most rows just use the shared per-description answer. Rows under a
        description that's ever been ambiguous need their OWN specific
        record looked up, since different rows can have different answers.
        """
        desc = txn["description"]
        if desc in category_by_description:
            return category_by_description[desc]
        if desc in failed_descriptions:
            return "FAILED - rerun script"
        if desc in ambiguous_descriptions:
            for record in cache.records_for(desc):
                if record["date"] == txn["date"] and record["amount"] == txn["amount"]:
                    if record["category"] == NEEDS_MANUAL_REVIEW:
                        return "NEEDS MANUAL REVIEW - rerun to answer"
                    return record["category"]
            return "NEEDS MANUAL REVIEW - rerun to answer"
        return "FAILED - rerun script"
 
    out_fieldnames = list(fieldnames) + ["category"]
    with open(args.output_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=out_fieldnames)
        writer.writeheader()
        for txn in transactions:
            row = dict(txn)
            row["category"] = category_for_row(txn)
            writer.writerow(row)
 
    print(f"Done. Wrote {len(transactions)} categorized transactions to {args.output_csv}")

    release_connection(conn)
 
 
if __name__ == "__main__":
    main()

    
# python categoriseAug.py TransactionHistory.csv categorised.csv

# For Bash: export GEMINI_API_KEY="your-actual-key-here"
# For Cmd Prompt: set GEMINI_API_KEY="your-actual-key-here"