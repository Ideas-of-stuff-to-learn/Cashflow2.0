import { useState } from 'react';
import {parseCSVFiles, categorizeCached, categorizeLLM } from '../../api.js';
import { useApp } from '../../AppContext.js';
import { mergeById } from '../../utils/homescreen/homescreenUtils.js';
export function useFileProcessor(setStatus, setError,selectedFiles){
    const [loading, setLoading] = useState(false);
    const {
        setTransactions,
        setCategorising,
        setProcessingStage
    } = useApp();

    async function processFiles() {
        if (selectedFiles.length === 0) {
            setError('Please select files first');
            return;
        }

        setLoading(true);
        setError(null);
        setProcessingStage('parsing');

        try {
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
                setStatus('Checking cache...');
                setProcessingStage('checkingCache');
                const phase1 = await categorizeCached(needsCategorization);

                setTransactions(prev => mergeById(prev, phase1));
                setProcessingStage('waitingForLLM');
                setCategorising(true);
                // Phase 2: Categorise in background - may take a while
                // Navigation has already happened, this continues running
                const pendingItems = phase1.filter(t => t.category === 'PENDING_LLM');
                if (pendingItems.length > 0) {
                    setStatus(`Categorising ${pendingItems.length} new transactions...`);
                    const phase2 = await categorizeLLM(pendingItems);

                    // Merge phase2 results back into phase1
                    // Match by description since same description = same category
                    const phase2ByDescription = {};
                    for (const t of phase2) {
                        phase2ByDescription[t.description] = t.category;
                    }

                    const merged = phase1.map(t => {
                        if (t.category !== 'PENDING_LLM') return t;
                        const resolvedCategory = phase2ByDescription[t.description];
                        return resolvedCategory
                            ? { ...t, category: resolvedCategory }
                            : t;
                    });

                    setTransactions(prev => mergeById(prev, merged));
                    setProcessingStage('done');
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