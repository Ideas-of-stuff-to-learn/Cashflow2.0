NEEDS_MANUAL_REVIEW = "MANUALLY CATEGORISE"

# Distinct from NEEDS_MANUAL_REVIEW: this marks a transaction that
# simply never got a real answer - a categorisation request that timed
# out or failed (client-side, in useFileProcessor.js) before an answer
# came back, or a batch that failed server-side (run_llm_tier,
# categoriseAPI2.py) after retries were exhausted. Nothing has judged
# this transaction ambiguous or hard - it just didn't get resolved
# this time. Should be retried later, NOT surfaced to the user as
# something THEY need to manually pick a category for - that's what
# NEEDS_MANUAL_REVIEW is for.
#
# Same string value as the frontend's checkingName.js - this used to
# be two different sentinels (the frontend's own NOT_YET_CATEGORISED
# for its own retry-exhaustion, and a separate backend-only
# 'FAILED - rerun' string for a server-side batch/item failure) that
# meant the same thing but weren't recognized as equivalent anywhere -
# the frontend's retry button, pending-state display, and staleness
# check only ever looked for its own value, so a transaction the
# backend marked 'FAILED - rerun' was invisible to all of that. Merged
# into one shared value so either origin is treated identically.
NOT_YET_CATEGORISED = "NOT YET CATEGORISED"
