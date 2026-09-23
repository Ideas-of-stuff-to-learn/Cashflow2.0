import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { useApp } from '../../AppContext.js';
import { resolveCategories, resolveRemainingToOther } from '../../api.js';
import { NEEDS_MANUAL_REVIEW } from '../../../shared/checkingName.js';
import ManualReviewStatsModal from './ManualReviewStatsModal.js';
import ManualReviewSequentialModal from './ManualReviewSequentialModal.js';

export default function ManualReviewGate() {
    const {
        manualReviewFlow,
        setManualReviewFlow,
        enterSequentialReview,
        closeManualReviewFlow,
        setTransactions,
        bumpChartDataVersion,
        categoryNames,
    } = useApp();

    // Accumulates picks made during sequential review without a network
    // call per pick — flushed all at once when the last item is picked.
    const pendingResolutionsRef = useRef([]);

    const [localItems, setLocalItems] = useState([]);
    const [flushing, setFlushing] = useState(false);
    const [flushError, setFlushError] = useState(false);
    const [isDone, setIsDone] = useState(false);

    // Sync local item list from the flow when entering sequential stage.
    useEffect(() => {
        if (manualReviewFlow?.stage === 'sequential') {
            setLocalItems(manualReviewFlow.needsReviewItems || []);
            setIsDone(false);
            setFlushError(false);
            pendingResolutionsRef.current = [];
        }
    }, [manualReviewFlow?.stage]);

    // AppState safety net: if the user backgrounds the app mid-review,
    // fire the resolve-remaining-to-other call so nothing is left hanging.
    // Equivalent of sendBeacon on web.
    useEffect(() => {
        if (manualReviewFlow?.stage !== 'sequential') return;

        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'background' || nextState === 'inactive') {
                // Best-effort, fire and forget — same as sendBeacon semantics.
                resolveRemainingToOther().catch(() => {});
            }
        });

        return () => subscription.remove();
    }, [manualReviewFlow?.stage]);

    const handlePutAllInOther = useCallback(async () => {
        try {
            await resolveRemainingToOther();
            setTransactions(prev => prev.map(t =>
                t.category === NEEDS_MANUAL_REVIEW ? { ...t, category: 'Other' } : t
            ));
            bumpChartDataVersion();
            closeManualReviewFlow();
        } catch (e) {
            console.warn('resolveRemainingToOther failed:', e.message);
        }
    }, [setTransactions, bumpChartDataVersion, closeManualReviewFlow]);

    const flushPendingResolutions = useCallback(async () => {
        if (pendingResolutionsRef.current.length === 0) {
            setIsDone(true);
            return;
        }

        setFlushing(true);
        setFlushError(false);

        try {
            await resolveCategories(pendingResolutionsRef.current);
            bumpChartDataVersion();
            // Apply all pending optimistic updates to global state.
            const resolutionMap = new Map(
                pendingResolutionsRef.current.map(r => [
                    `${r.description}|${r.date}|${r.amount}`,
                    r.category,
                ])
            );
            setTransactions(prev => prev.map(t => {
                const key = `${t.description}|${t.date}|${t.amount}`;
                return resolutionMap.has(key) ? { ...t, category: resolutionMap.get(key) } : t;
            }));
            pendingResolutionsRef.current = [];
            setFlushing(false);
            setIsDone(true);
        } catch (e) {
            console.warn('Flush failed:', e.message);
            setFlushing(false);
            setFlushError(true);
        }
    }, [setTransactions, bumpChartDataVersion]);

    const handleSequentialPick = useCallback((category) => {
        const item = localItems[0];
        if (!item) return;

        pendingResolutionsRef.current.push({
            description: item.description,
            date: item.date,
            amount: item.amount,
            category,
        });

        const remaining = localItems.slice(1);
        setLocalItems(remaining);

        if (remaining.length === 0) {
            flushPendingResolutions();
        }
    }, [localItems, flushPendingResolutions]);

    const handleRetryFlush = useCallback(() => {
        setFlushError(false);
        flushPendingResolutions();
    }, [flushPendingResolutions]);

    const handleDoneClose = useCallback(() => {
        closeManualReviewFlow();
        setIsDone(false);
        setLocalItems([]);
        pendingResolutionsRef.current = [];
    }, [closeManualReviewFlow]);

    if (!manualReviewFlow) return null;

    if (manualReviewFlow.stage === 'stats') {
        return (
            <ManualReviewStatsModal
                flow={manualReviewFlow}
                onContinue={enterSequentialReview}
                onPutAllInOther={handlePutAllInOther}
            />
        );
    }

    const currentItem = localItems[0] || null;
    const showDone = isDone;

    return (
        <ManualReviewSequentialModal
            item={currentItem}
            remaining={localItems.length}
            categoryNames={categoryNames.filter(c => c !== NEEDS_MANUAL_REVIEW)}
            onPick={handleSequentialPick}
            flushing={flushing}
            flushError={flushError}
            isDone={showDone}
            onRetry={handleRetryFlush}
            onDoneClose={handleDoneClose}
        />
    );
}
