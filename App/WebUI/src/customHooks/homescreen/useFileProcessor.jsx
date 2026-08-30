import { useState } from 'react';
import { parseCSVFiles } from '../../api';
import { useTransactions, useProcessing, useChartFilter } from '../../appState';
import { mergeById } from '../../utils/homescreen/homescreenUtils';
import { NOT_YET_CATEGORISED } from '../../checkingName';
import { runCacheTiers } from './cacheTierRunner';
import { runLlmTier } from './llmTierRunner';

export function useFileProcessor(setStatus, setError, selectedFiles) {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' });

    const { transactions, setTransactions } = useTransactions();
    const { setCategorising, setProcessingStage, startManualReviewFlowIfNeeded } = useProcessing();
    const { bumpChartDataVersion } = useChartFilter();

    async function categorizeTransactions(itemsNeedingCategorization, runLabel = 'Categorise') {
        setProcessingStage('checkingCache');
        setCategorising(true);

        const phase1 = await runCacheTiers(itemsNeedingCategorization, {
            setStatus, setError, setTransactions, bumpChartDataVersion, setProgress, runLabel,
        });

        setProcessingStage('waitingForLLM');
        setCategorising(true);

        await runLlmTier(phase1, {
            setStatus, setError, setTransactions, bumpChartDataVersion, setProcessingStage, setProgress, runLabel,
        });

        // The categorisation run has now GENUINELY finished (cache
        // tiers + LLM tier both done) - this is the one correct point
        // to check whether the blocking manual-review flow needs to
        // trigger, using the items exactly as this run left them
        // (itemsNeedingCategorization's ids, looked up fresh from the
        // now-current transactions state so we get their FINAL
        // resolved categories, not the pre-run snapshot).
        const processedIds = new Set(itemsNeedingCategorization.map(t => t.id));
        setTransactions(currentTransactions => {
            const processedNow = currentTransactions.filter(t => processedIds.has(t.id));
            startManualReviewFlowIfNeeded(processedNow);
            return currentTransactions; // no actual change - just reading current state
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
            setProgress({ current: 0, total: 0, phase: '' });
        }
    }

    return {
        processFiles,
        loading,
        setLoading,
        progress,
    };
}