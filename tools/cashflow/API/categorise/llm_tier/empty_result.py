"""
categorise/llm_tier/empty_result.py

The shape returned by run_llm_tier when there's nothing to categorise -
pulled out into its own file so orchestrator.py doesn't open with a
20-line dict literal before any real logic starts.
"""


def empty_llm_result():
    return {
        'transactions': [],
        'timings': {
            'exact_ms': 0,
            'merchant_ms': 0,
            'similarity_ms': 0,
            'recheck_ms': 0,
            'gemini_ms': 0,
            'merchant_write_ms': 0,
            'global_cache_save_ms': 0,
            'personal_cache_save_ms': 0,
            'batches': 0,
            'gemini_calls': 0,

            'exact_transactions': 0,
            'exact_percentage': 0.0,

            'merchant_transactions': 0,
            'merchant_percentage': 0.0,

            'similarity_transactions': 0,
            'similarity_percentage': 0.0,

            'gemini_transactions': 0,
            'gemini_percentage': 0.0,
        },
    }