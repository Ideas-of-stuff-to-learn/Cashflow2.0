// customHooks/homescreen/llmTierRunner.js
import { categorizeLLM } from '../../api';
import { mergeById, chunkArray } from '../../utils/homescreen/homescreenUtils';
import { NOT_YET_CATEGORISED } from '../../checkingName';
import {LLM_CHUNK_SIZE, CLIENT_TIMEOUT_MS, GEMINI_REQUEST_TIMEOUT_MS, AUTO_RETRY_ATTEMPTS, AUTO_RETRY_DELAY_MS, sleep} from '../../config/categorisationConfig'

// Runs one /categorize/llm chunk, automatically retrying up to
// AUTO_RETRY_ATTEMPTS times total before giving up - same reasoning
// as runCachePhase in cacheTierRunner.js. Returns null only once every
// attempt has failed, or the chunk's result array on success.
async function runLlmChunk(items, chunkIndex, chunkCount, { setStatus, runLabel }) {
    for (let attempt = 1; attempt <= AUTO_RETRY_ATTEMPTS; attempt++) {
        try {
            const result = await categorizeLLM(items, {
                timeoutMs: CLIENT_TIMEOUT_MS,
                batchSize: LLM_CHUNK_SIZE,
                geminiTimeoutMs: GEMINI_REQUEST_TIMEOUT_MS,
                onTiming: (elapsedMs) => {
                    console.log(
                        `[${runLabel}] LLM batch ${chunkIndex + 1}/${chunkCount} done - ` +
                        `${items.length} txns, HTTP ${(elapsedMs / 1000).toFixed(1)}s`
                    );
                },
            });

            console.log(
                `[${runLabel}] LLM batch ${chunkIndex + 1}/${chunkCount} backend timings:`,
                result.backendTimings
            );

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

// Runs the LLM tier over phase1 (the result of runCacheTiers) -
// filters for anything still 'PENDING_LLM', chunks it, and works
// through each chunk with automatic retry. Returns nothing - all its
// output goes through setTransactions progressively, same as the
// cache tier runner, and processingStage/categorising are set by the
// caller (useFileProcessor.js), same reasoning as cacheTierRunner.js.
export async function runLlmTier(phase1, {
    setStatus, setError, setTransactions, bumpChartDataVersion, setProcessingStage, runLabel = 'Categorise',
}) {
    const pendingItems = phase1.filter(t => t.category === 'PENDING_LLM');

    if (pendingItems.length === 0) {
        // Nothing reached the LLM tier at all - every item was already
        // resolved by the cache tier. Normal, good outcome, not a bug.
        setStatus('All transactions resolved via cache - no LLM step needed.');
        setProcessingStage('done');
        return;
    }

    const chunks = chunkArray(pendingItems, LLM_CHUNK_SIZE);
    const phase2ByDescription = {};
    let workingPhase1 = phase1;

    for (let i = 0; i < chunks.length; i++) {
        setStatus(
            chunks.length > 1
                ? `Categorising batch ${i + 1}/${chunks.length} (${chunks[i].length} transactions)...`
                : `Categorising ${chunks[i].length} new transactions...`
        );

        const chunkResult = await runLlmChunk(chunks[i], i, chunks.length, { setStatus, runLabel });
        if (chunkResult === null) {
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

        for (const t of chunkResult.transactions) {
            phase2ByDescription[t.description] = t.category;
        }

        workingPhase1 = workingPhase1.map(t => {
            if (t.category !== 'PENDING_LLM') return t;
            const resolvedCategory = phase2ByDescription[t.description];
            return resolvedCategory ? { ...t, category: resolvedCategory } : t;
        });

        setTransactions(prev => mergeById(prev, workingPhase1));
        bumpChartDataVersion();
    }

    setProcessingStage('done');
}