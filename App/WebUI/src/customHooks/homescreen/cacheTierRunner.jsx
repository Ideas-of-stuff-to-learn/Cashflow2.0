// customHooks/homescreen/cacheTierRunner.js
import { categorizeCachedExact, categorizeCachedMerchant, categorizeCachedSimilarity } from '../../api';
import { mergeById, chunkArray } from '../../utils/homescreen/homescreenUtils';
import { NOT_YET_CATEGORISED } from '../../checkingName';
import { CACHE_CHUNK_SIZE, CLIENT_TIMEOUT_MS, AUTO_RETRY_ATTEMPTS, AUTO_RETRY_DELAY_MS, sleep } from '../../config/categorisationConfig';

async function runCachePhase(phaseFn, items, phaseLabel, chunkIndex, chunkCount, { setStatus, runLabel }) {
    for (let attempt = 1; attempt <= AUTO_RETRY_ATTEMPTS; attempt++) {
        try {
            const result = await phaseFn(items, {
                timeoutMs: CLIENT_TIMEOUT_MS,
                onTiming: (elapsedMs) => {
                    console.log(
                        `[${runLabel}] ${phaseLabel} batch ${chunkIndex + 1}/${chunkCount} done - ` +
                        `${items.length} txns, HTTP ${(elapsedMs / 1000).toFixed(1)}s`
                    );
                },
            });

            console.log(
                `[${runLabel}] ${phaseLabel} batch ${chunkIndex + 1}/${chunkCount} backend timings:`,
                result.backendTimings
            );

            return result;
        } catch (err) {
            if (err.isTimeout) {
                console.warn(`[${runLabel}] ${phaseLabel} batch ${chunkIndex + 1}/${chunkCount} TIMED OUT after ${(err.elapsedMs / 1000).toFixed(1)}s (attempt ${attempt}/${AUTO_RETRY_ATTEMPTS})`);
            } else {
                console.warn(`[${runLabel}] ${phaseLabel} batch ${chunkIndex + 1}/${chunkCount} FAILED: ${err.message} (attempt ${attempt}/${AUTO_RETRY_ATTEMPTS})`);
            }
            if (attempt < AUTO_RETRY_ATTEMPTS) {
                const backoffMs = AUTO_RETRY_DELAY_MS * (2 ** (attempt - 1));
                setStatus(`${phaseLabel} check hit a snag - retrying automatically (${attempt}/${AUTO_RETRY_ATTEMPTS})...`);
                await sleep(backoffMs);
            }
        }
    }
    return null;
}

// Runs the full exact -> merchant -> similarity cache-tier pipeline.
// setProgress carries both the batch-position numbers AND, after each
// phase, a lastTiming object {phase, httpElapsedMs} - just the round
// trip time for cache-tier calls, since their backendTimings payload
// isn't the interesting part here (that's curated for the LLM tier
// instead, see llmTierRunner.js).
export async function runCacheTiers(itemsNeedingCategorization, {
    setStatus, setError, setTransactions, bumpChartDataVersion, setProgress, runLabel = 'Categorise',
}) {
    const cacheChunks = chunkArray(itemsNeedingCategorization, CACHE_CHUNK_SIZE);
    let phase1 = [];

    for (let i = 0; i < cacheChunks.length; i++) {
        let chunkWorking = cacheChunks[i];
        let stageFailed = false;

        setStatus(
            cacheChunks.length > 1
                ? `Checking cache: batch ${i + 1}/${cacheChunks.length} (${cacheChunks[i].length} transactions)...`
                : `Checking cache (${cacheChunks[i].length} transactions)...`
        );
        setProgress(prev => ({ ...prev, current: i + 1, total: cacheChunks.length, phase: 'Checking cache' }));

        const exactResult = await runCachePhase(
            categorizeCachedExact, chunkWorking, 'Exact', i, cacheChunks.length,
            { setStatus, runLabel }
        );

        if (exactResult === null) {
            stageFailed = true;
        } else {
            chunkWorking = exactResult.transactions;

            console.log(
                `[${runLabel}] Exact batch ${i + 1}/${cacheChunks.length} ` +
                `HTTP total: ${(exactResult.httpElapsedMs / 1000).toFixed(2)}s`
            );

            setTransactions(prev => mergeById(prev, chunkWorking));
            bumpChartDataVersion();
            setProgress(prev => ({
                ...prev,
                lastTiming: { phase: 'Exact', httpElapsedMs: exactResult.httpElapsedMs },
            }));
        }

        if (!stageFailed) {
            const stillNeedsMerchant = chunkWorking.filter(t => t.category === 'PENDING_LLM');
            if (stillNeedsMerchant.length > 0) {
                const merchantResult = await runCachePhase(
                    categorizeCachedMerchant, stillNeedsMerchant, 'Merchant', i, cacheChunks.length,
                    { setStatus, runLabel }
                );
                if (merchantResult === null) {
                    stageFailed = true;
                } else {
                    const byId = new Map(merchantResult.transactions.map(t => [t.id, t]));
                    chunkWorking = chunkWorking.map(t => byId.get(t.id) ?? t);
                    setTransactions(prev => mergeById(prev, chunkWorking));
                    bumpChartDataVersion();
                    setProgress(prev => ({
                        ...prev,
                        lastTiming: { phase: 'Merchant', httpElapsedMs: merchantResult.httpElapsedMs },
                    }));
                }
            }
        }

        if (!stageFailed) {
            const stillNeedsSimilarity = chunkWorking.filter(t => t.category === 'PENDING_LLM');
            if (stillNeedsSimilarity.length > 0) {
                const similarityResult = await runCachePhase(
                    categorizeCachedSimilarity, stillNeedsSimilarity, 'Similarity', i, cacheChunks.length,
                    { setStatus, runLabel }
                );
                if (similarityResult === null) {
                    stageFailed = true;
                } else {
                    const byId = new Map(similarityResult.transactions.map(t => [t.id, t]));
                    chunkWorking = chunkWorking.map(t => byId.get(t.id) ?? t);
                    setTransactions(prev => mergeById(prev, chunkWorking));
                    bumpChartDataVersion();
                    setProgress(prev => ({
                        ...prev,
                        lastTiming: { phase: 'Similarity', httpElapsedMs: similarityResult.httpElapsedMs },
                    }));
                }
            }
        }

        if (stageFailed) {
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

        phase1 = phase1.concat(chunkWorking);
    }

    return phase1;
}