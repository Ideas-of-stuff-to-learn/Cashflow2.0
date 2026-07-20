import { useState } from 'react';
import { parseCSVFiles, categorizeCachedExact, categorizeCachedMerchant, categorizeCachedSimilarity, categorizeLLM } from '../../api.js';
import { useApp } from '../../AppContext.js';
import { mergeById, chunkArray } from '../../utils/homescreen/homescreenUtils.js';
import { NOT_YET_CATEGORISED } from '../../checkingName.js';

// --- Chunking config for /categorize/cached ---
//
// Why this exists too, maybe even more than the LLM one below:
// run_cache_tiers() (categoriseAPI2.py) does CPU-bound work per UNIQUE
// description in the request - combined_status() lookups for all of
// them, and for anything not already resolved, match_known_merchant()
// and find_similar_cached_description(), which are both O(merchant
// count) / O(global-resolved-description count) via rapidfuzz, called
// ONCE PER UNRESOLVED DESCRIPTION. All synchronous, inside one request.
// This runs on EVERY upload (not just ones that end up needing fresh
// LLM calls), so a big multi-year upload can make this the actual
// crash cause even when nothing new ever reaches the LLM tier.
//
// CACHE_CHUNK_SIZE: raw transactions per /categorize/cached request.
// There's no backend-side "batch" concept here like there is for the
// LLM tier - this is just a flat, directly-tunable request size.
// Change this if crashes persist / to trade off request count.
const CACHE_CHUNK_SIZE = 1000;

// --- Chunking config for /categorize/llm ---
//
// Why this exists: the backend's run_llm_tier() (categoriseAPI2.py)
// batches whatever it's given into groups of `batch_size` UNIQUE
// DESCRIPTIONS (not raw transaction rows - repeated merchants collapse
// into one Gemini call) and works through them sequentially, ALL
// INSIDE ONE HTTP REQUEST. Upload a few years of statements at once
// and "pending" can easily be several thousand rows - one request then
// means one Flask worker holding all of that in memory while grinding
// through many Gemini calls back to back for minutes. On a small
// backend instance that's the exact shape of thing that gets
// SIGKILLed (OOM) or hits a platform request timeout mid-flight.
//
// LLM_BATCH_SIZE below is that real, actual `batch_size` value - it
// gets sent straight through to the backend as the `batch_size` field
// on the request (see categorizeLLM in api.js and the /categorize/llm
// route in backend.py), which used to be a fixed default of 200 with
// no way to change it from here. It is ALSO used as this app's own
// per-request chunk size, so each HTTP request we send corresponds to
// exactly one server-side Gemini batch - no separate/hidden
// multiplication layer.
//
// MIN_LLM_BATCH_SIZE is a floor on top of that: no matter how low
// LLM_BATCH_SIZE is set, the effective value used never drops below
// this. Without a floor, setting LLM_BATCH_SIZE very low on a huge
// upload turns into a LOT of small requests - each one still pays full
// request overhead, and /categorize/llm is rate-limited to 20/day per
// user (backend.py), so too many tiny requests can burn through that
// daily cap before an upload even finishes.
//
// Both numbers are yours to adjust. Backend also caps whatever's sent
// to between 1 and 2000 - see the /categorize/llm route.
const LLM_BATCH_SIZE = 400;
const MIN_LLM_BATCH_SIZE = 200;
const LLM_CHUNK_SIZE = Math.max(MIN_LLM_BATCH_SIZE, LLM_BATCH_SIZE);

// --- Worker timeout / request timing ---
//
// The backend's gunicorn worker has its own hard timeout - currently
// 120s, set via Render's Start Command (not in this repo, see the
// handoff doc). If a single request runs longer than that, gunicorn
// kills the worker mid-request with NO response sent back at all -
// that's the SIGKILL behaviour we've been chasing. From this app's
// side that looks like a request that just hangs forever / drops.
//
// WORKER_TIMEOUT_SECONDS documents that backend value - keep it in
// sync with whatever gunicorn is actually configured with. Adjust if
// the Render Start Command's --timeout value ever changes.
//
// CLIENT_TIMEOUT_MS is what THIS app actually enforces, per request,
// via AbortController (see fetchWithTimeout in api.js). It's set a
// little under WORKER_TIMEOUT_SECONDS, by TIMEOUT_SAFETY_BUFFER_SECONDS,
// so the client gives up and treats it as a clean, catchable timeout
// slightly BEFORE the backend would've killed the connection anyway -
// giving us a chance to react (see the catch blocks below) instead of
// just seeing a dropped connection with no useful information.
//
// All three numbers are yours to adjust.
const WORKER_TIMEOUT_SECONDS = 120;
const TIMEOUT_SAFETY_BUFFER_SECONDS = 10;
const CLIENT_TIMEOUT_MS = Math.max(1, WORKER_TIMEOUT_SECONDS - TIMEOUT_SAFETY_BUFFER_SECONDS) * 1000;

// --- Gemini call timeout (backend-side, controlled from here) ---
//
// Different network hop from CLIENT_TIMEOUT_MS above: that one is how
// long THIS APP waits for a response from OUR backend. This one is how
// long OUR BACKEND waits for a response from GEMINI, on its own
// outbound call - a completely separate connection this app never
// touches directly. It has to be enforced server-side (see
// categorize_batch in categoriseAugDB.py, which applies it via
// google-genai's http_options), but the actual NUMBER lives here and
// gets sent on every /categorize/llm request as gemini_timeout_ms (see
// categorizeLLM in api.js) - kept alongside the rest of the adjustable
// config instead of buried in a backend file.
//
// Why it matters: the genai SDK sets NO timeout on its HTTP calls by
// default - a slow/hanging Gemini response just blocks the backend
// worker indefinitely. Previously the ONLY thing that ever stopped
// that was gunicorn's own worker timeout (WORKER_TIMEOUT_SECONDS above)
// - killing the whole worker with SIGKILL, which is far worse than a
// normal caught exception: it can corrupt the DB connection pool (seen
// as "SSL error: decryption failed or bad record mac" on the very next
// request) and Flask never gets a chance to roll back or return a
// proper error at all.
//
// GEMINI_REQUEST_TIMEOUT_MS gives that call its own deadline instead,
// comfortably under WORKER_TIMEOUT_SECONDS, so a slow call raises a
// normal, catchable exception well before gunicorn would ever need to
// step in. The backend can retry a batch up to 3 times for OTHER
// reasons (invalid category, rate limiting - see max_retries in
// categorize_batch), each retried attempt getting this same per-call
// timeout, so worst case is roughly (GEMINI_REQUEST_TIMEOUT_MS * 3) +
// backoff sleeps, which needs to stay safely under
// WORKER_TIMEOUT_SECONDS * 1000 with margin. At 30000ms that's
// (30000 * 3) + ~6000ms backoff = ~96s, comfortably under 120s.
//
// Adjust this if WORKER_TIMEOUT_SECONDS changes, or if legitimate
// large-batch responses are being cut off (raise it, but keep the math
// above in mind), or if you're seeing timeouts on batches that should
// be fast (lower it, or lower LLM_BATCH_SIZE above instead). Backend
// also caps whatever's sent to between 1000 and 90000 - see the
// /categorize/llm route in backend.py.
const GEMINI_REQUEST_TIMEOUT_MS = 30000;

// --- Automatic retry for transient failures ---
//
// Why this exists: a failure here (a client-side timeout, a backend
// cold-start, a momentary network blip) usually resolves itself within
// a few seconds - the person manually re-running the exact same action
// right after a failure very often just... works, because whatever was
// briefly wrong has already passed by the time they notice and react.
// That's not something the person should have to notice and act on -
// the app already knows the action failed and can just try it again
// itself before bothering them with an error at all.
//
// AUTO_RETRY_ATTEMPTS is the TOTAL number of attempts for a single
// phase/batch (the first try plus this many automatic retries after a
// failure) - only after ALL of these are exhausted does anything get
// marked NOT_YET_CATEGORISED and surfaced as an error the person has
// to act on. AUTO_RETRY_DELAY_MS is the BASE delay, applied with
// exponential backoff (delay * 2^(attempt-1): 3s, 6s, 12s...) - each
// repeated failure makes it progressively more likely something is
// genuinely wrong (not just a one-off blip), so back off further each
// time instead of hammering at the same fixed interval.
const AUTO_RETRY_ATTEMPTS = 3;
const AUTO_RETRY_DELAY_MS = 3000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function useFileProcessor(setStatus, setError,selectedFiles){
    const [loading, setLoading] = useState(false);
    const {
        transactions,
        setTransactions,
        setCategorising,
        setProcessingStage,
        bumpChartDataVersion
    } = useApp();

    // Runs the full cache-tier -> LLM-tier categorisation pipeline over
    // whatever list it's given. Shared by both halves of processFiles()
    // below (retrying previously NOT_YET_CATEGORISED rows, and newly
    // parsed rows) - same chunking, same timeout handling, same
    // progressive state updates either way. runLabel just tags console
    // log lines so it's clear in dev tools which half of a run a given
    // line came from.
    async function categorizeTransactions(itemsNeedingCategorization, runLabel = 'Categorise') {
        setProcessingStage('checkingCache');
        setCategorising(true);

        // Same reasoning as the LLM chunking below, applied to
        // the cache tier: split into bounded-size requests
        // instead of sending the whole pending list at once.
        const cacheChunks = chunkArray(itemsNeedingCategorization, CACHE_CHUNK_SIZE);
        let phase1 = [];

    // Runs one cache-tier phase (exact/merchant/similarity) against
    // `items`, automatically retrying up to AUTO_RETRY_ATTEMPTS times
    // total before giving up - see that constant's comment for why.
    // Returns null only once every attempt has failed (caller decides
    // how to handle that), or the phase's result array on success.
    async function runCachePhase(phaseFn, items, phaseLabel, chunkIndex, chunkCount) {
        for (let attempt = 1; attempt <= AUTO_RETRY_ATTEMPTS; attempt++) {
            try {
                const result = await phaseFn(items, {
                    timeoutMs: CLIENT_TIMEOUT_MS,
                    onTiming: (elapsedMs) => {
                        console.log(`[${runLabel}] ${phaseLabel} batch ${chunkIndex + 1}/${chunkCount} done - ${items.length} txns, ${(elapsedMs / 1000).toFixed(1)}s`);
                    },
                });
                return result;
            } catch (err) {
                if (err.isTimeout) {
                    console.warn(`[${runLabel}] ${phaseLabel} batch ${chunkIndex + 1}/${chunkCount} TIMED OUT after ${(err.elapsedMs / 1000).toFixed(1)}s (attempt ${attempt}/${AUTO_RETRY_ATTEMPTS})`);
                } else {
                    console.warn(`[${runLabel}] ${phaseLabel} batch ${chunkIndex + 1}/${chunkCount} FAILED: ${err.message} (attempt ${attempt}/${AUTO_RETRY_ATTEMPTS})`);
                }
                if (attempt < AUTO_RETRY_ATTEMPTS) {
                    // Exponential: 3s, 6s, 12s... - each failure makes it
                    // progressively more likely something's genuinely
                    // wrong (not just a one-off blip), so back off
                    // further each time instead of hammering at the
                    // same fixed interval.
                    const backoffMs = AUTO_RETRY_DELAY_MS * (2 ** (attempt - 1));
                    setStatus(`${phaseLabel} check hit a snag - retrying automatically (${attempt}/${AUTO_RETRY_ATTEMPTS})...`);
                    await sleep(backoffMs);
                }
            }
        }
        return null;
    }

    for (let i = 0; i < cacheChunks.length; i++) {
        // chunkWorking tracks this chunk's current state ACROSS all
        // three phases - each phase below only re-sends whatever's
        // still 'PENDING_LLM' after the previous one, then the result
        // gets merged back in by id. This is what lets exact-match
        // results (usually the bulk of a chunk, and effectively free -
        // see run_exact_tier in categoriseAPI2.py) reach the screen
        // immediately, instead of sitting behind however long the
        // merchant/similarity fuzzy tiers take for the few descriptions
        // that actually need them.
        let chunkWorking = cacheChunks[i];
        let stageFailed = false;

        setStatus(
            cacheChunks.length > 1
                ? `Checking cache: batch ${i + 1}/${cacheChunks.length} (${cacheChunks[i].length} transactions)...`
                : `Checking cache (${cacheChunks[i].length} transactions)...`
        );

        const exactResult = await runCachePhase(categorizeCachedExact, chunkWorking, 'Exact', i, cacheChunks.length);
        if (exactResult === null) {
            stageFailed = true;
        } else {
            chunkWorking = exactResult;
            setTransactions(prev => mergeById(prev, chunkWorking));
            // Committed to the DB already (update_transaction_categories
            // inside /categorize/cached/exact) - bump immediately rather
            // than waiting for the merchant/similarity phases too.
            bumpChartDataVersion();
        }

        if (!stageFailed) {
            const stillNeedsMerchant = chunkWorking.filter(t => t.category === 'PENDING_LLM');
            if (stillNeedsMerchant.length > 0) {
                const merchantResult = await runCachePhase(categorizeCachedMerchant, stillNeedsMerchant, 'Merchant', i, cacheChunks.length);
                if (merchantResult === null) {
                    stageFailed = true;
                } else {
                    const byId = new Map(merchantResult.map(t => [t.id, t]));
                    chunkWorking = chunkWorking.map(t => byId.get(t.id) ?? t);
                    setTransactions(prev => mergeById(prev, chunkWorking));
                    bumpChartDataVersion();
                }
            }
        }

        if (!stageFailed) {
            const stillNeedsSimilarity = chunkWorking.filter(t => t.category === 'PENDING_LLM');
            if (stillNeedsSimilarity.length > 0) {
                const similarityResult = await runCachePhase(categorizeCachedSimilarity, stillNeedsSimilarity, 'Similarity', i, cacheChunks.length);
                if (similarityResult === null) {
                    stageFailed = true;
                } else {
                    const byId = new Map(similarityResult.map(t => [t.id, t]));
                    chunkWorking = chunkWorking.map(t => byId.get(t.id) ?? t);
                    setTransactions(prev => mergeById(prev, chunkWorking));
                    bumpChartDataVersion();
                }
            }
        }

        if (stageFailed) {
            // Same fallback as before a single failure anywhere in this
            // chunk's cache-tier work: whatever in THIS chunk never got
            // a real answer, plus every chunk not yet started, gets
            // marked NOT_YET_CATEGORISED (not NEEDS_MANUAL_REVIEW -
            // nothing actually looked at these) and the whole cache-tier
            // run stops here rather than losing all chunking progress
            // to one uncaught error.
            const stillUnresolvedThisChunk = chunkWorking
                .filter(t => t.category === 'PENDING_LLM')
                .map(t => ({ ...t, category: NOT_YET_CATEGORISED }));
            const notYetStartedChunks = cacheChunks.slice(i + 1).flat()
                .map(t => ({ ...t, category: NOT_YET_CATEGORISED }));
            const remaining = stillUnresolvedThisChunk.concat(notYetStartedChunks);

            phase1 = phase1.concat(
                chunkWorking.filter(t => t.category !== 'PENDING_LLM'),
                stillUnresolvedThisChunk,
                notYetStartedChunks,
            );
            setTransactions(prev => mergeById(prev, remaining));
            setError('Checking the cache failed partway through - remaining transactions were left as "not yet categorised", you can retry later.');
            break;
        }

        // This chunk fully resolved (or correctly left at PENDING_LLM
        // for the LLM tier) across all three phases.
        phase1 = phase1.concat(chunkWorking);
    }

        setProcessingStage('waitingForLLM');
        setCategorising(true);
        // Phase 2: Categorise in background - may take a while
        // Navigation has already happened, this continues running
        const pendingItems = phase1.filter(t => t.category === 'PENDING_LLM');
        if (pendingItems.length > 0) {
            // Split into bounded-size chunks (see LLM_CHUNK_SIZE
            // comment above) instead of sending everything in
            // one request - keeps each request's backend-side
            // work, and this app's own memory footprint per
            // round trip, bounded regardless of upload size.
            const chunks = chunkArray(pendingItems, LLM_CHUNK_SIZE);

            // Accumulated across chunks so a description
            // resolved in an earlier chunk stays resolved when
            // merging later chunks' results.
            const phase2ByDescription = {};
            // Rebuilt after every chunk and pushed into app
            // state immediately, so the UI reflects progress
            // chunk-by-chunk instead of only at the very end.
            let workingPhase1 = phase1;

    // Runs one /categorize/llm chunk, automatically retrying up to
    // AUTO_RETRY_ATTEMPTS times total before giving up - same reasoning
    // as runCachePhase above. Returns null only once every attempt has
    // failed, or the chunk's result array on success.
    async function runLlmChunk(items, chunkIndex, chunkCount) {
        for (let attempt = 1; attempt <= AUTO_RETRY_ATTEMPTS; attempt++) {
            try {
                const result = await categorizeLLM(items, {
                    timeoutMs: CLIENT_TIMEOUT_MS,
                    batchSize: LLM_CHUNK_SIZE,
                    geminiTimeoutMs: GEMINI_REQUEST_TIMEOUT_MS,
                    onTiming: (elapsedMs) => {
                        console.log(`[${runLabel}] LLM batch ${chunkIndex + 1}/${chunkCount} done - ${items.length} txns, batch_size=${LLM_CHUNK_SIZE}, ${(elapsedMs / 1000).toFixed(1)}s`);
                    },
                });
                return result;
            } catch (err) {
                if (err.isTimeout) {
                    console.warn(`[${runLabel}] LLM batch ${chunkIndex + 1}/${chunkCount} TIMED OUT after ${(err.elapsedMs / 1000).toFixed(1)}s (attempt ${attempt}/${AUTO_RETRY_ATTEMPTS})`);
                } else {
                    console.warn(`[${runLabel}] LLM batch ${chunkIndex + 1}/${chunkCount} FAILED: ${err.message} (attempt ${attempt}/${AUTO_RETRY_ATTEMPTS})`);
                }
                if (attempt < AUTO_RETRY_ATTEMPTS) {
                    const backoffMs = AUTO_RETRY_DELAY_MS * (2 ** (attempt - 1));
                    setStatus(`Categorising hit a snag - retrying automatically (${attempt}/${AUTO_RETRY_ATTEMPTS})...`);
                    await sleep(backoffMs);
                }
            }
        }
        return null;
    }

            for (let i = 0; i < chunks.length; i++) {
                setStatus(
                    chunks.length > 1
                        ? `Categorising batch ${i + 1}/${chunks.length} (${chunks[i].length} transactions)...`
                        : `Categorising ${chunks[i].length} new transactions...`
                );

                const chunkResult = await runLlmChunk(chunks[i], i, chunks.length);
                if (chunkResult === null) {
                    // Every automatic attempt failed - same fallback as
                    // before: mark this chunk and every not-yet-attempted
                    // chunk as NOT_YET_CATEGORISED, not NEEDS_MANUAL_REVIEW -
                    // these transactions never got a real answer, they
                    // just failed or ran out of time.
                    const remainingDescriptions = new Set(
                        chunks.slice(i).flat().map(t => t.description)
                    );
                    workingPhase1 = workingPhase1.map(t =>
                        (remainingDescriptions.has(t.description) && t.category === 'PENDING_LLM')
                            ? { ...t, category: NOT_YET_CATEGORISED }
                            : t
                    );
                    setTransactions(prev => mergeById(prev, workingPhase1));
                    setError('Categorising failed partway through - remaining transactions were left as "not yet categorised", you can retry later.');
                    break;
                }

                // Match by description since same description = same category
                for (const t of chunkResult) {
                    phase2ByDescription[t.description] = t.category;
                }

                workingPhase1 = workingPhase1.map(t => {
                    if (t.category !== 'PENDING_LLM') return t;
                    const resolvedCategory = phase2ByDescription[t.description];
                    return resolvedCategory
                        ? { ...t, category: resolvedCategory }
                        : t;
                });

                setTransactions(prev => mergeById(prev, workingPhase1));
                // Same reasoning as the cache-tier tick above - this
                // chunk's results are already committed via
                // /categorize/llm's update_transaction_categories call.
                bumpChartDataVersion();
            }

            setProcessingStage('done');
        } else {
            // Nothing reached the LLM tier at all - every item was
            // already resolved by the cache tier (exact/global match,
            // known merchant, or similarity match). This is the normal,
            // good outcome, not a bug - it's WHY no "Categorising
            // batch..." line ever showed up. Say so explicitly so it
            // doesn't look like the LLM step silently got skipped.
            setStatus('All transactions resolved via cache - no LLM step needed.');
            setProcessingStage('done');
        }
    }

    // The single entry point for the "Categorise" button - handles
    // BOTH retrying anything left NOT_YET_CATEGORISED from a previous
    // run AND processing newly selected files, in that order. There's
    // no separate "Retry" button/action anymore - retrying previously-
    // failed items is just part of what pressing Categorise does,
    // since a person shouldn't need to know or care whether some of
    // their transactions failed last time versus being brand new.
    async function processFiles() {
        // Read fresh from current state, not a stale snapshot - this
        // also naturally excludes anything that's since picked up a
        // real category (e.g. resolved by another chunk's mid-run
        // merchant/similarity re-check), since it wouldn't be sitting
        // at NOT_YET_CATEGORISED anymore if so.
        const notYetCategorisedItems = transactions.filter(t => t.category === NOT_YET_CATEGORISED);

        if (selectedFiles.length === 0 && notYetCategorisedItems.length === 0) {
            setError('Please select files first');
            return;
        }

        setLoading(true);
        setError(null);
        setProcessingStage('parsing');

        try {
            // Retry previously-failed items FIRST, before anything new -
            // these already went through parsing once, they just never
            // got a final answer last time.
            if (notYetCategorisedItems.length > 0) {
                await categorizeTransactions(notYetCategorisedItems, 'Retry');
            }

            if (selectedFiles.length > 0) {
                // Phase 1: Parse CSV files - fast, no LLM
                setStatus('Parsing CSV files...');
                const parsed = await parseCSVFiles(selectedFiles);

                // Merge into existing state (history + any prior uploads
                // this session) rather than replacing it outright. parsed
                // now carries the real category for any row that already
                // existed (a re-upload), so this shows the correct category
                // immediately with no flicker.
                setTransactions(prev => mergeById(prev, parsed));
                setCategorising(true);

                // Only genuinely new rows need to go through cache tiers /
                // LLM at all - anything already fully known (a re-upload of
                // an already-categorized transaction) skips this entirely,
                // since there's nothing left to resolve for it.
                const needsCategorization = parsed.filter(t => t.category == null);

                if (needsCategorization.length > 0) {
                    await categorizeTransactions(needsCategorization, 'Categorise');
                }
            }

        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
            setStatus(null);
            setCategorising(false);
            setProcessingStage(prev =>
                prev === 'done' ? 'done' : 'idle'
            );
        }
    }

    return {
        processFiles,
        loading,
        setLoading,
    }
}