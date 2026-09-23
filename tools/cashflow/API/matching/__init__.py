from matching.merchants import (
    load_merchants,
    add_merchant,
    add_merchants_batch,
    patch_merchants_category_rename,
    match_known_merchant,
    match_known_merchants_batch,
    invalidate_merchant_automaton,
    normalise_for_matching,
)
from matching.similarity import find_similar_cached_description, find_similar_cached_descriptions_batch
from matching.gemini import build_prompt, categorize_batch, chunked, MODEL_NAME, FALLBACK_MODELS, DEFAULT_GEMINI_REQUEST_TIMEOUT_MS
from matching.categories import load_categories