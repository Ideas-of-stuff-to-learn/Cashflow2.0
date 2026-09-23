"""
matching/gemini.py

Everything about talking to Gemini: prompt building, the actual API
call with retry/fallback-model logic, and the small batching helper
shared by callers that chunk a list of pseudo-transactions.
"""

import json
import sys
import time

from google.genai import errors as genai_errors

from checkingName import NEEDS_MANUAL_REVIEW

MODEL_NAME = "gemini-2.5-flash"

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
# specifying one.
DEFAULT_GEMINI_REQUEST_TIMEOUT_MS = 30000


def build_prompt(transactions, categories):
    """Build a single prompt asking the model to categorize a batch of transactions.

    Each transaction dict can optionally include "previous_invalid_category"
    - if present, the prompt tells the model exactly what it answered last
    time that was rejected, so it can self-correct (e.g. a truncated or
    mangled category name) instead of blindly re-guessing from scratch.
    """
    category_list = ", ".join(categories)
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
    same overloaded one repeatedly.

    Returns a list the same length as `transactions`. Each element is one of:
      - a real category string (success)
      - NEEDS_MANUAL_REVIEW (the model kept responding, but never gave a
        valid category for this item after max_retries attempts)
      - None (a TRANSIENT failure - rate limit, server error, or an
        unparseable whole response - exhausted retries.)
    """
    if models_to_try is None:
        models_to_try = [MODEL_NAME] + FALLBACK_MODELS

    allowed = set(categories)

    final_results = {}
    give_up_to_manual = set()
    previous_invalid_by_index = {}
    pending = list(range(len(transactions)))

    for attempt in range(max_retries):
        if not pending:
            break

        model_name = models_to_try[min(attempt, len(models_to_try) - 1)]

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
                        "category": category,
                        "merchant": merchant,
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
            raise
        except (json.JSONDecodeError, ValueError) as e:
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