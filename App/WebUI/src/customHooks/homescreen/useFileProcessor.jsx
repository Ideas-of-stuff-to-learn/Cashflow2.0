import { useState } from 'react';
import { parseCSVFiles, categorizeCachedExact, categorizeCachedMerchant, categorizeCachedSimilarity, categorizeLLM } from '../../api';
import { useApp } from '../../AppContext';
import { mergeById, chunkArray } from '../../utils/homescreen/homescreenUtils';
import { NOT_YET_CATEGORISED } from '../../checkingName';
import {
    CACHE_CHUNK_SIZE, LLM_CHUNK_SIZE, CLIENT_TIMEOUT_MS,
    GEMINI_REQUEST_TIMEOUT_MS, AUTO_RETRY_ATTEMPTS, AUTO_RETRY_DELAY_MS, sleep,
} from '../../config/categorisationConfig';
import { runCacheTiers } from './cacheTierRunner';
import { runLlmTier } from './llmTierRunner';

export function useFileProcessor(setStatus, setError, selectedFiles) {
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
    // parsed rows).
    async function categorizeTransactions(itemsNeedingCategorization, runLabel = 'Categorise') {
        setProcessingStage('checkingCache');
        setCategorising(true);

        const phase1 = await runCacheTiers(itemsNeedingCategorization, {
            setStatus, setError, setTransactions, bumpChartDataVersion, runLabel,
        });

        setProcessingStage('waitingForLLM');
        setCategorising(true);

        await runLlmTier(phase1, {
            setStatus, setError, setTransactions, bumpChartDataVersion, setProcessingStage, runLabel,
        });
    }

    async function processFiles() {
        const notYetCategorisedItems = transactions.filter(t => t.category === NOT_YET_CATEGORISED);

        if (selectedFiles.length === 0 && notYetCategorisedItems.length === 0) {
            setError('Please select files first');
            return;
        }

        setLoading(true);
        setError(null);
        setProcessingStage('parsing');

        try {
            if (notYetCategorisedItems.length > 0) {
                await categorizeTransactions(notYetCategorisedItems, 'Retry');
            }

            if (selectedFiles.length > 0) {
                setStatus('Parsing CSV files...');
                const parsed = await parseCSVFiles(selectedFiles);

                setTransactions(prev => mergeById(prev, parsed));
                setCategorising(true);

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
            setProcessingStage(prev => prev === 'done' ? 'done' : 'idle');
        }
    }

    return {
        processFiles,
        loading,
        setLoading,
    };
}