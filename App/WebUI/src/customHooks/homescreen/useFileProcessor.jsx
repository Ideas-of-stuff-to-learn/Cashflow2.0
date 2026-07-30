import { useState } from 'react';
import { parseCSVFiles } from '../../api';
import { useApp } from '../../AppContext';
import { mergeById } from '../../utils/homescreen/homescreenUtils';
import { NOT_YET_CATEGORISED } from '../../checkingName';
import { runCacheTiers } from './cacheTierRunner';
import { runLlmTier } from './llmTierRunner';

export function useFileProcessor(setStatus, setError, selectedFiles) {
    const [loading, setLoading] = useState(false);
    // total: 0 is the "nothing in progress" sentinel ProgressBar checks
    // for to decide whether to render at all.
    const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' });

    const {
        transactions,
        setTransactions,
        setCategorising,
        setProcessingStage,
        bumpChartDataVersion
    } = useApp();

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
            // Belt-and-braces reset - covers the error/early-return
            // paths too, not just the clean-success path already
            // handled inside llmTierRunner.js.
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