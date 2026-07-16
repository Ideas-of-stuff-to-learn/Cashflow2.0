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
from rapidfuzz import fuzz, process

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
 
def categorize_batch(client, transactions, categories, max_retries=3, gemini_timeout_ms=DEFAULT_GEMINI_REQUEST_TIMEOUT_MS):
    """Send a batch to Gemini and parse the JSON response. Retries ONLY the
    specific items that failed validation or parsing - not the whole batch -
    so a single bad/mangled category from the model doesn't force re-asking
    about everything else that was already answered correctly.
 
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
                model=MODEL_NAME,
                contents=prompt,
                config={
                    "temperature": 0,
                    "response_mime_type": "application/json",
                    "http_options": {"timeout": gemini_timeout_ms},
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
            # Both are transient - back off and retry rather than crashing.
            # These affect the WHOLE request (it never reached the model),
            # so everything currently pending stays pending for the retry.
            is_retryable = "429" in str(e) or "503" in str(e) or "UNAVAILABLE" in str(e)
            if is_retryable and attempt < max_retries - 1:
                wait = 2 ** (attempt + 1)
                print(f"  API temporarily unavailable ({e.__class__.__name__}), waiting {wait}s before retry...", file=sys.stderr)
                time.sleep(wait)
                continue
            if is_retryable:
                print(
                    f"  Still unavailable after {max_retries} attempts. "
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