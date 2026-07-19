import { useState, useMemo, useRef, useCallback } from 'react';
import { resolveCategories, getCategories, getTransactionHistory } from '../../api.js';
import { NEEDS_MANUAL_REVIEW } from '../../checkingName.js';
import { makeKey } from '../../utils/contentsscreen/contentsUtils.js';

export function useCategoryResolve({
    transactions, setTransactions, setCategories, bumpChartDataVersion,
    selectedIds, exitSelectionMode,
}) {
    const [reviewItem, setReviewItem] = useState(null);
    const [bulkPickerVisible, setBulkPickerVisible] = useState(false);
    // resolving is now only used as a ref to guard against double-taps
    // on the modal - we no longer keep the modal open while awaiting
    // the network, so there's no reason to re-render the modal's
    // category list as disabled during the call.
    const resolvingRef = useRef(false);
    const [outOfSyncMessage, setOutOfSyncMessage] = useState(null);

    // Drives the "N left" counter in the top-right of the resolve modal.
    // Recomputes off `transactions` directly, so it stays accurate as
    // optimistic updates below flip items away from NEEDS_MANUAL_REVIEW -
    // no separate tracking needed.
    const manualReviewCount = useMemo(() => {
        return transactions.reduce((count, t) => (
            t.category === NEEDS_MANUAL_REVIEW ? count + 1 : count
        ), 0);
    }, [transactions]);

    const openReviewItem = useCallback((item) => {
        setReviewItem(item);
    }, []);

    const closeModal = useCallback(() => {
        setReviewItem(null);
        setBulkPickerVisible(false);
    }, []);

    // Close the modal IMMEDIATELY on pick, then do the network call in
    // the background. The optimistic update to local transaction state
    // already makes the UI look right instantly - the network call is
    // purely to confirm the server agrees (and to trigger a resync if
    // it doesn't). There's no reason to keep the modal open while that
    // round-trip happens, and doing so is exactly why the modal felt
    // slow: it stayed visible, with all category options rendered as
    // `disabled={resolving}`, for the full network latency of the
    // resolve call, even though the user already made their decision.
    const handleCategoryPick = useCallback(async (category) => {
        if (resolvingRef.current) return; // guard double-tap
        resolvingRef.current = true;

        // Snapshot what we need before closing - reviewItem / selectedIds
        // could be cleared by the time the async work finishes.
        const isBulk = bulkPickerVisible;
        const currentReviewItem = reviewItem;
        const currentSelectedIds = new Set(selectedIds);

        // Close immediately - user sees the result, modal gone.
        setReviewItem(null);
        setBulkPickerVisible(false);
        if (isBulk) exitSelectionMode();

        try {
            if (isBulk) {
                const items = transactions.filter(t => currentSelectedIds.has(t.id));
                if (items.length === 0) return;

                const resolutions = items.map(t => ({
                    description: t.description,
                    date: t.date,
                    amount: t.amount,
                    category,
                }));

                // Optimistic update
                setTransactions(prev => prev.map(t =>
                    currentSelectedIds.has(t.id) ? { ...t, category } : t
                ));

                const { skipped } = await resolveCategories(resolutions);
                bumpChartDataVersion();

                if (skipped && skipped.length > 0) {
                    const skippedKeys = new Set(skipped.map(makeKey));
                    const outOfSyncItems = items.filter(t => skippedKeys.has(makeKey(t)));
                    if (outOfSyncItems.length > 0) {
                        setOutOfSyncMessage(`${outOfSyncItems.length} out of sync - reverting...`);
                        setTransactions(prev => prev.map(t => {
                            const original = outOfSyncItems.find(o => o.id === t.id);
                            return original ? { ...t, category: original.category } : t;
                        }));
                        try {
                            const [freshCategories, freshTransactions] = await Promise.all([getCategories(), getTransactionHistory()]);
                            setCategories(freshCategories);
                            setTransactions(freshTransactions);
                        } catch (e) {
                            console.warn('Failed to resync after out-of-sync bulk resolve:', e.message);
                        }
                        setTimeout(() => setOutOfSyncMessage(null), 2500);
                    }
                }
            } else if (currentReviewItem) {
                const originalCategory = currentReviewItem.category;

                // Optimistic update
                setTransactions(prev => prev.map(t =>
                    (t.id && t.id === currentReviewItem.id) ||
                    (!t.id && t.date === currentReviewItem.date && t.description === currentReviewItem.description && t.amount === currentReviewItem.amount)
                        ? { ...t, category }
                        : t
                ));

                const { skipped } = await resolveCategories([{
                    description: currentReviewItem.description,
                    date: currentReviewItem.date,
                    amount: currentReviewItem.amount,
                    category,
                }]);
                bumpChartDataVersion();

                if (skipped && skipped.length > 0) {
                    setOutOfSyncMessage('Out of sync - reverting...');
                    setTransactions(prev => prev.map(t =>
                        (t.id && t.id === currentReviewItem.id) ||
                        (!t.id && t.date === currentReviewItem.date && t.description === currentReviewItem.description && t.amount === currentReviewItem.amount)
                            ? { ...t, category: originalCategory }
                            : t
                    ));
                    try {
                        const [freshCategories, freshTransactions] = await Promise.all([getCategories(), getTransactionHistory()]);
                        setCategories(freshCategories);
                        setTransactions(freshTransactions);
                    } catch (e) {
                        console.warn('Failed to resync after out-of-sync resolve:', e.message);
                    }
                    setTimeout(() => setOutOfSyncMessage(null), 2500);
                }
            }
        } catch (e) {
            console.warn('Resolve failed:', e.message);
        } finally {
            resolvingRef.current = false;
        }
    }, [bulkPickerVisible, reviewItem, selectedIds, transactions, exitSelectionMode, setTransactions, setCategories, bumpChartDataVersion]);

    return {
        reviewItem, openReviewItem,
        bulkPickerVisible, setBulkPickerVisible,
        outOfSyncMessage,
        manualReviewCount,
        handleCategoryPick,
        closeModal,
    };
}
