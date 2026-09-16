import { useState, useRef } from 'react';
import { parseCSVFiles } from '../../api';
import { useTransactions, useProcessing, useChartFilter } from '../../appState';
import { mergeById } from '../../utils/homescreen/homescreenUtils';
import { NOT_YET_CATEGORISED } from '../../checkingName';
import { runCacheTiers } from './cacheTierRunner';
import { runLlmTier } from './llmTierRunner';

export function useFileProcessor(setStatus, setError, selectedFiles) {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' });
    const [duplicateNotice, setDuplicateNotice] = useState(null);

    // If manual review needs to start but we're showing the upload
    // summary popup first, we park the processed transactions here and
    // fire startManualReviewFlowIfNeeded only when the user dismisses
    // the notice — so the upload summary always precedes manual review.
    const pendingManualReviewItems = useRef(null);

    const { transactions, setTransactions } = useTransactions();
    const { setCategorising, setProcessingStage, startManualReviewFlowIfNeeded } = useProcessing();
    const { bumpChartDataVersion } = useChartFilter();

    // autoTriggerManualReview: true for retry runs (no upload notice will
    // follow), false for new-file uploads (notice must appear first).
    async function categorizeTransactions(itemsNeedingCategorization, runLabel = 'Categorise', autoTriggerManualReview = true) {
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

        const processedIds = new Set(itemsNeedingCategorization.map(t => t.id));

        if (autoTriggerManualReview) {
            setTransactions(currentTransactions => {
                const processedNow = currentTransactions.filter(t => processedIds.has(t.id));
                startManualReviewFlowIfNeeded(processedNow);
                return currentTransactions;
            });
        } else {
            // Caller will show upload summary popup first; stash the
            // processed items so clearDuplicateNotice can fire manual
            // review after the user dismisses the notice.
            setTransactions(currentTransactions => {
                pendingManualReviewItems.current = currentTransactions.filter(t => processedIds.has(t.id));
                return currentTransactions;
            });
        }
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
                await categorizeTransactions(notYetCategorisedItems, 'Retry', true);
            }

            if (selectedFiles.length > 0) {
                setStatus('Parsing CSV files...');
                const { transactions: parsed, duplicateFilenames, duplicateContents, batchCopyDuplicates, successfulCount } = await parseCSVFiles(selectedFiles);

                setTransactions(prev => mergeById(prev, parsed));
                setCategorising(true);

                const needsCategorization = parsed.filter(t => t.category == null);

                if (needsCategorization.length > 0) {
                    // Don't auto-trigger manual review — show upload summary first
                    await categorizeTransactions(needsCategorization, 'Categorise', false);
                }

                const hasDuplicateInfo = duplicateFilenames.length > 0 || duplicateContents.length > 0 || batchCopyDuplicates.length > 0;
                if (hasDuplicateInfo || successfulCount > 0) {
                    setDuplicateNotice({ filenames: duplicateFilenames, contents: duplicateContents, batchCopies: batchCopyDuplicates, successfulCount });
                } else {
                    // No notice to show — trigger manual review immediately
                    const pending = pendingManualReviewItems.current;
                    pendingManualReviewItems.current = null;
                    if (pending) startManualReviewFlowIfNeeded(pending);
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

    function clearDuplicateNotice() {
        setDuplicateNotice(null);
        // Fire manual review now that the user has dismissed the upload summary
        const pending = pendingManualReviewItems.current;
        pendingManualReviewItems.current = null;
        if (pending) startManualReviewFlowIfNeeded(pending);
    }

    return {
        processFiles,
        loading,
        setLoading,
        progress,
        duplicateNotice,
        clearDuplicateNotice,
    };
}