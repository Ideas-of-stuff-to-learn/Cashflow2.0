import { useApp } from '../../AppContext';
import { resolveCategories } from '../../api';
import ManualReviewStatsModal from './ManualReviewStatsModal';
import ManualReviewSequentialModal from './ManualReviewSequentialModal';

export default function ManualReviewGate() {
    const {
        manualReviewFlow, setManualReviewFlow, enterSequentialReview, closeManualReviewFlow,
        setTransactions, bumpChartDataVersion, categoryNames,
    } = useApp();

    if (!manualReviewFlow) return null;

    async function handlePutInOther() {
        const resolutions = manualReviewFlow.needsReviewItems.map(t => ({
            description: t.description,
            date: t.date,
            amount: t.amount,
            category: 'Other',
        }));

        try {
            await resolveCategories(resolutions);
            setTransactions(prev => prev.map(t => {
                const wasNeedingReview = manualReviewFlow.needsReviewItems.some(r =>
                    r.description === t.description && r.date === t.date && r.amount === t.amount
                );
                return wasNeedingReview ? { ...t, category: 'Other' } : t;
            }));
            bumpChartDataVersion();
        } catch (e) {
            console.warn('Failed to bulk-resolve to Other:', e.message);
        } finally {
            closeManualReviewFlow();
        }
    }

    async function handleSequentialPick(category) {
        const current = manualReviewFlow.needsReviewItems[0];
        if (!current) return;

        try {
            await resolveCategories([{
                description: current.description,
                date: current.date,
                amount: current.amount,
                category,
            }]);

            setTransactions(prev => prev.map(t =>
                (t.description === current.description && t.date === current.date && t.amount === current.amount)
                    ? { ...t, category }
                    : t
            ));
            bumpChartDataVersion();
        } catch (e) {
            console.warn('Failed to resolve transaction during sequential review:', e.message);
        }

        const nextItems = manualReviewFlow.needsReviewItems.slice(1);
        if (nextItems.length === 0) {
            closeManualReviewFlow();
        } else {
            setManualReviewFlow(prev => prev ? { ...prev, needsReviewItems: nextItems } : prev);
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
        if (!current) {
            closeManualReviewFlow();
            return null;
        }
        return (
            <ManualReviewSequentialModal
                current={current}
                remainingCount={manualReviewFlow.needsReviewItems.length}
                selectableCategories={categoryNames}
                onPick={handleSequentialPick}
            />
        );
    }

    return null;
}