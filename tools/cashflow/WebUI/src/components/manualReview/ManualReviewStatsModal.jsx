import '../../styles/manualReviewModal.css';

// Modal 1 - shown the moment a categorisation run finishes with any
// NEEDS_MANUAL_REVIEW transactions left. Full-screen, blocks
// everything behind it (no click-outside dismiss at all) - the person
// must pick one of the two buttons to proceed.
export default function ManualReviewStatsModal({ flow, onCategoriseNow, onPutInOther }) {
    const { totalTransactions, autoResolvedCount, needsReviewCount } = flow;

    const fmt = (count) => {
        if (totalTransactions === 0) return '0';
        const pct = (count / totalTransactions) * 100;
        if (pct === 0) return '0';
        if (pct >= 1) return Math.round(pct).toString();
        return parseFloat(pct.toFixed(2)).toString();
    };
    const autoPercentLabel = fmt(autoResolvedCount);
    const needsReviewPercentLabel = fmt(needsReviewCount);

    return (
        <div className="manual-review-backdrop">
            <div className="manual-review-modal">
                <p className="manual-review-text">
                    You've uploaded {totalTransactions.toLocaleString()} transactions.
                </p>
                <p className="manual-review-text">
                    {autoPercentLabel}% ({autoResolvedCount.toLocaleString()}) were categorised automatically.
                </p>
                <p className="manual-review-text">
                    {needsReviewPercentLabel}% ({needsReviewCount.toLocaleString()}) were unable to be automatically categorised and require your decision in order to provide you with a complete and accurate view of your data.
                </p>
                <p className="manual-review-question">
                    Would you like to categorise these transactions now, or put them all in the Other category?
                </p>
                <div className="manual-review-buttons">
                    <button className="manual-review-btn manual-review-btn-primary" onClick={onCategoriseNow}>
                        Categorise Now
                    </button>
                    <button className="manual-review-btn manual-review-btn-secondary" onClick={onPutInOther}>
                        Put in Other
                    </button>
                </div>
            </div>
        </div>
    );
}