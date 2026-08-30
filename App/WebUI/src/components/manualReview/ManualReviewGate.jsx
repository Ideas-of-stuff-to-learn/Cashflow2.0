import { useRef, useState, useEffect } from 'react';
import { useTransactions, useProcessing, useChartFilter } from '../../appState';
import { resolveCategories, resolveRemainingToOther, beaconResolveRemainingToOther } from '../../api';
import { NEEDS_MANUAL_REVIEW } from '../../checkingName';
import ManualReviewStatsModal from './ManualReviewStatsModal';
import ManualReviewSequentialModal from './ManualReviewSequentialModal';

export default function ManualReviewGate() {
    const { manualReviewFlow, setManualReviewFlow, enterSequentialReview, closeManualReviewFlow } = useProcessing();
    const { setTransactions, categoryNames } = useTransactions();
    const { bumpChartDataVersion } = useChartFilter();

    const pendingResolutionsRef = useRef([]);
    const [flushError, setFlushError] = useState(false);
    const [flushing, setFlushing] = useState(false);

    // Page-unload safety net: if the user closes the tab mid-sequential,
    // sendBeacon resolves whatever is still NEEDS_MANUAL_REVIEW in the DB
    // to Other. Any picks accumulated locally but not yet flushed are lost
    // here, but they come back as NEEDS_MANUAL_REVIEW on next login and
    // the existing overlay catches them.
    useEffect(() => {
        if (manualReviewFlow?.stage !== 'sequential') return;

        function handlePageHide() {
            beaconResolveRemainingToOther();
        }

        window.addEventListener('pagehide', handlePageHide);
        return () => window.removeEventListener('pagehide', handlePageHide);
    }, [manualReviewFlow?.stage]);

    if (!manualReviewFlow) return null;

    async function handlePutInOther() {
        try {
            await resolveRemainingToOther();
            setTransactions(prev => prev.map(t =>
                t.category === NEEDS_MANUAL_REVIEW ? { ...t, category: 'Other' } : t
            ));
            bumpChartDataVersion();
        } catch (e) {
            console.warn('Failed to bulk-resolve to Other:', e.message);
        } finally {
            closeManualReviewFlow();
        }
    }

    function handleSequentialPick(category) {
        const current = manualReviewFlow.needsReviewItems[0];
        if (!current) return;

        pendingResolutionsRef.current.push({
            description: current.description,
            date: current.date,
            amount: current.amount,
            category,
        });

        setTransactions(prev => prev.map(t =>
            (t.description === current.description && t.date === current.date && t.amount === current.amount)
                ? { ...t, category }
                : t
        ));

        const nextItems = manualReviewFlow.needsReviewItems.slice(1);

        if (nextItems.length === 0) {
            flushPendingResolutions();
        } else {
            setManualReviewFlow(prev => prev ? { ...prev, needsReviewItems: nextItems } : prev);
        }
    }

    async function flushPendingResolutions() {
        setFlushing(true);
        setFlushError(false);
        try {
            await resolveCategories(pendingResolutionsRef.current);
            bumpChartDataVersion();
            pendingResolutionsRef.current = [];
            closeManualReviewFlow();
        } catch (e) {
            console.warn('Failed to flush resolutions:', e.message);
            setFlushError(true);
        } finally {
            setFlushing(false);
        }
    }

    if (manualReviewFlow.stage === 'stats') {
        return (
            <ManualReviewStatsModal
                flow={manualReviewFlow}
                onCategoriseNow={enterSequentialReview}
                onPutInOther={handlePutInOther}
            />
        );
    }

    if (manualReviewFlow.stage === 'sequential') {
        const current = manualReviewFlow.needsReviewItems[0];
        const isDone = !current;

        return (
            <ManualReviewSequentialModal
                current={current ?? null}
                remainingCount={manualReviewFlow.needsReviewItems.length}
                selectableCategories={categoryNames}
                onPick={handleSequentialPick}
                flushError={flushError}
                flushing={flushing}
                isDone={isDone}
                onRetry={flushPendingResolutions}
            />
        );
    }

    return null;
}