import { useRef, useState, useEffect } from 'react';
import { useTransactions, useProcessing, useChartFilter, useUserPreferences } from '../../appState';
import { resolveCategories, resolveAndExit, beaconResolveRemainingToOther } from '../../api';
import { NEEDS_MANUAL_REVIEW } from '../../checkingName';
import ManualReviewStatsModal from './ManualReviewStatsModal';
import ManualReviewSequentialModal from './ManualReviewSequentialModal';

export default function ManualReviewGate() {
    const { manualReviewFlow, setManualReviewFlow, enterSequentialReview, closeManualReviewFlow } = useProcessing();
    const { setTransactions, categoryNames } = useTransactions();
    const { setMrPicks } = useUserPreferences();
    const { bumpChartDataVersion } = useChartFilter();

    const pendingResolutionsRef = useRef([]);
    const [exitConfirmPending, setExitConfirmPending] = useState(false);
    const [flushing, setFlushing] = useState(false);
    const [exitFailed, setExitFailed] = useState(false);

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

    function savePendingToStorage(picks) {
        setMrPicks(picks);
    }

    function clearPendingStorage() {
        setMrPicks(null);
    }

    function handleSequentialPick(category) {
        const current = manualReviewFlow.needsReviewItems[0];
        if (!current) return;

        const resolution = {
            description: current.description,
            date: current.date,
            amount: current.amount,
            category,
        };

        pendingResolutionsRef.current.push(resolution);
        savePendingToStorage(pendingResolutionsRef.current);

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

    function flushPendingResolutions() {
        const picks = [...pendingResolutionsRef.current];
        pendingResolutionsRef.current = [];
        clearPendingStorage();
        bumpChartDataVersion();
        // Show "All done!" immediately; server syncs in background.
        // If it fails after one retry, picks come back as NEEDS_MANUAL_REVIEW on reload.
        setManualReviewFlow(prev => prev ? { ...prev, needsReviewItems: [] } : prev);
        setTimeout(closeManualReviewFlow, 900);
        resolveCategories(picks).catch(() =>
            resolveCategories(picks).catch(e => console.warn('[ManualReview] flush failed:', e.message))
        );
    }

    function handleExitConfirm() {
        const picks = [...pendingResolutionsRef.current];
        pendingResolutionsRef.current = [];
        clearPendingStorage();
        // Optimistic local update — charts and table reflect the change immediately
        setTransactions(prev => prev.map(t =>
            t.category === NEEDS_MANUAL_REVIEW ? { ...t, category: 'Other' } : t
        ));
        bumpChartDataVersion();
        setExitFailed(false);

        const serverCall = resolveAndExit(picks)
            .catch(() => resolveAndExit(picks)); // one retry

        // Race: if the server responds within 400ms, close with no visible delay.
        // If slower, show the spinner as a fallback until it settles.
        Promise.race([
            serverCall.then(() => 'done'),
            new Promise(r => setTimeout(() => r('slow'), 400)),
        ]).then(result => {
            if (result === 'done') {
                closeManualReviewFlow();
            } else {
                setFlushing(true);
                serverCall
                    .then(() => { setFlushing(false); closeManualReviewFlow(); })
                    .catch(() => { setFlushing(false); setExitFailed(true); });
            }
        });
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
                flushing={flushing}
                isDone={isDone}
                onExit={() => { setExitConfirmPending(true); setExitFailed(false); }}
                exitConfirmPending={exitConfirmPending}
                exitFailed={exitFailed}
                onExitConfirm={handleExitConfirm}
                onExitCancel={() => { setExitConfirmPending(false); setExitFailed(false); }}
            />
        );
    }

    return null;
}