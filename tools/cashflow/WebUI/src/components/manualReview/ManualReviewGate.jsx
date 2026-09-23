import { useRef, useState, useEffect } from 'react';
import { useTransactions, useProcessing, useChartFilter, useUserPreferences } from '../../appState';
import { resolveCategories, resolveAndExit, beaconResolveRemainingToOther } from '../../api';
import { NEEDS_MANUAL_REVIEW } from '../../checkingName';
import ManualReviewStatsModal from './ManualReviewStatsModal';
import ManualReviewSequentialModal from './ManualReviewSequentialModal';

export default function ManualReviewGate() {
    const { manualReviewFlow, setManualReviewFlow, enterSequentialReview, closeManualReviewFlow } = useProcessing();
    const { setTransactions, categoryNames, categoryColors } = useTransactions();
    const { setMrPicks } = useUserPreferences();
    const { bumpChartDataVersion } = useChartFilter();

    const pendingResolutionsRef = useRef([]);
    const skippedItemsRef       = useRef([]);
    const totalCountRef         = useRef(0);

    const [exitConfirmPending, setExitConfirmPending] = useState(false);
    const [flushing,           setFlushing]           = useState(false);
    const [exitFailed,         setExitFailed]         = useState(false);
    // null = not at end-of-round; number = count of skipped items at round end
    const [roundComplete,      setRoundComplete]      = useState(null);

    // Page-unload safety net: beacon resolves remaining NEEDS_MANUAL_REVIEW to Other.
    // Skipped items are still NEEDS_MANUAL_REVIEW in the DB, so they'll reappear on next login.
    useEffect(() => {
        if (manualReviewFlow?.stage !== 'sequential') return;
        function handlePageHide() { beaconResolveRemainingToOther(); }
        window.addEventListener('pagehide', handlePageHide);
        return () => window.removeEventListener('pagehide', handlePageHide);
    }, [manualReviewFlow?.stage]);

    if (!manualReviewFlow) {
        totalCountRef.current   = 0;
        skippedItemsRef.current = [];
        return null;
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    function savePendingToStorage(picks) { setMrPicks(picks); }
    function clearPendingStorage()       { setMrPicks(null); }

    function advanceQueue(nextItems) {
        if (nextItems.length > 0) {
            setManualReviewFlow(prev => prev ? { ...prev, needsReviewItems: nextItems } : prev);
            return;
        }
        // Round finished — check for skipped items
        if (skippedItemsRef.current.length > 0) {
            setRoundComplete(skippedItemsRef.current.length);
        } else {
            flushPendingResolutions();
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
        savePendingToStorage(pendingResolutionsRef.current);

        setTransactions(prev => prev.map(t =>
            (t.description === current.description && t.date === current.date && t.amount === current.amount)
                ? { ...t, category }
                : t
        ));

        advanceQueue(manualReviewFlow.needsReviewItems.slice(1));
    }

    function handleSequentialSkip() {
        const current = manualReviewFlow.needsReviewItems[0];
        if (!current) return;
        // Skipped items stay NEEDS_MANUAL_REVIEW in both local state and DB
        skippedItemsRef.current.push(current);
        advanceQueue(manualReviewFlow.needsReviewItems.slice(1));
    }

    function flushPendingResolutions() {
        const picks = [...pendingResolutionsRef.current];
        pendingResolutionsRef.current = [];
        clearPendingStorage();
        bumpChartDataVersion();
        setManualReviewFlow(prev => prev ? { ...prev, needsReviewItems: [] } : prev);
        setTimeout(closeManualReviewFlow, 900);
        resolveCategories(picks).catch(() =>
            resolveCategories(picks).catch(e => console.warn('[ManualReview] flush failed:', e.message))
        );
    }

    // ── Skip round-complete handlers ─────────────────────────────────────

    function handleReviewSkippedAgain() {
        const skipped = [...skippedItemsRef.current];
        skippedItemsRef.current = [];
        totalCountRef.current   = skipped.length;
        setRoundComplete(null);
        setManualReviewFlow(prev => prev ? { ...prev, needsReviewItems: skipped } : prev);
    }

    function handleSkippedToOther() {
        // Optimistically mark skipped items as Other locally
        const skipped = skippedItemsRef.current;
        skippedItemsRef.current = [];
        setTransactions(prev => prev.map(t => {
            const match = skipped.find(s =>
                s.description === t.description && s.date === t.date && s.amount === t.amount
            );
            return match ? { ...t, category: 'Other' } : t;
        }));
        setRoundComplete(null);
        flushPendingResolutions();
    }

    // ── Exit confirm ─────────────────────────────────────────────────────

    function handleExitConfirm() {
        const picks = [...pendingResolutionsRef.current];
        pendingResolutionsRef.current = [];
        skippedItemsRef.current = [];
        clearPendingStorage();
        setTransactions(prev => prev.map(t =>
            t.category === NEEDS_MANUAL_REVIEW ? { ...t, category: 'Other' } : t
        ));
        bumpChartDataVersion();
        setExitFailed(false);

        const serverCall = resolveAndExit(picks).catch(() => resolveAndExit(picks));

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

    // ── Stats gate ───────────────────────────────────────────────────────

    function handlePutInOther() {
        setTransactions(prev => prev.map(t =>
            t.category === NEEDS_MANUAL_REVIEW ? { ...t, category: 'Other' } : t
        ));
        bumpChartDataVersion();
        // Switch to sequential stage with empty queue → shows "All done!" then auto-closes
        setManualReviewFlow(prev => prev ? { ...prev, stage: 'sequential', needsReviewItems: [] } : prev);
        setTimeout(closeManualReviewFlow, 900);
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
        const isDone  = !current && roundComplete === null;

        // Capture total count at the start of each round
        if (totalCountRef.current === 0 && manualReviewFlow.needsReviewItems.length > 0) {
            totalCountRef.current = manualReviewFlow.needsReviewItems.length;
        }

        return (
            <ManualReviewSequentialModal
                current={current ?? null}
                remainingCount={manualReviewFlow.needsReviewItems.length}
                totalCount={totalCountRef.current}
                selectableCategories={categoryNames}
                categoryColors={categoryColors}
                onPick={handleSequentialPick}
                onSkip={handleSequentialSkip}
                flushing={flushing}
                isDone={isDone}
                onExit={() => { setExitConfirmPending(true); setExitFailed(false); }}
                exitConfirmPending={exitConfirmPending}
                exitFailed={exitFailed}
                onExitConfirm={handleExitConfirm}
                onExitCancel={() => { setExitConfirmPending(false); setExitFailed(false); }}
                roundComplete={roundComplete !== null}
                skippedCount={roundComplete ?? 0}
                onReviewAgain={handleReviewSkippedAgain}
                onSkippedToOther={handleSkippedToOther}
            />
        );
    }

    return null;
}
