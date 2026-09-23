import { FALLBACK_CATEGORY_COLOR } from '../../theme';
import '../../styles/manualReviewModal.css';

export default function ManualReviewSequentialModal({
    current, remainingCount, totalCount, selectableCategories, categoryColors, onPick, onSkip,
    flushing, isDone, onExit, exitConfirmPending, exitFailed, onExitConfirm, onExitCancel,
    roundComplete, skippedCount, onReviewAgain, onSkippedToOther,
}) {
    // ── Saving / done overlay ────────────────────────────────────────────
    if (flushing || isDone) {
        return (
            <div className="mr-backdrop">
                <div className="mr-card mr-card-status">
                    {flushing ? (
                        <>
                            <div className="mr-spinner" />
                            <p className="mr-status-title">Saving…</p>
                            <p className="mr-status-sub">Categorising your transactions</p>
                        </>
                    ) : (
                        <>
                            <div className="mr-done-circle">✓</div>
                            <p className="mr-status-title">All done!</p>
                            <p className="mr-status-sub">All transactions categorised successfully</p>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // ── Round complete — skipped transactions remain ──────────────────────
    if (roundComplete) {
        return (
            <div className="mr-backdrop">
                <div className="mr-card mr-card-narrow">
                    <p className="mr-section-label">Round complete</p>
                    <h2 className="mr-exit-title">
                        {skippedCount} transaction{skippedCount !== 1 ? 's' : ''} skipped
                    </h2>
                    <p className="mr-exit-body">
                        What would you like to do with the {skippedCount} skipped transaction{skippedCount !== 1 ? 's' : ''}?
                    </p>
                    <div className="mr-exit-btns">
                        <button className="mr-btn mr-btn-secondary" onClick={onReviewAgain}>
                            Review again
                        </button>
                        <button className="mr-btn mr-btn-primary" onClick={onSkippedToOther}>
                            Put in Other
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Exit confirm ─────────────────────────────────────────────────────
    if (exitConfirmPending) {
        const titleText = exitFailed ? 'Something went wrong' : 'Exit manual review?';
        const bodyText  = exitFailed
            ? 'Could not save your picks. Please check your connection and try again.'
            : `Your picks so far will be saved. The remaining ${remainingCount} transaction${remainingCount !== 1 ? 's' : ''} will be placed in Other.`;
        return (
            <div className="mr-backdrop">
                <div className="mr-card mr-card-narrow">
                    <p className="mr-section-label" style={{ color: exitFailed ? 'var(--danger)' : undefined }}>
                        {exitFailed ? 'ERROR' : 'EXIT REVIEW'}
                    </p>
                    <h2 className="mr-exit-title">{titleText}</h2>
                    <p className="mr-exit-body">{bodyText}</p>
                    <div className="mr-exit-btns">
                        <button className="mr-btn mr-btn-secondary" onClick={onExitCancel}>
                            Go back
                        </button>
                        <button className="mr-btn mr-btn-danger" onClick={onExitConfirm}>
                            {exitFailed ? 'Retry exit' : 'Confirm exit'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Main category picker ─────────────────────────────────────────────
    const progressPct = totalCount > 0
        ? Math.round(((totalCount - remainingCount) / totalCount) * 100)
        : 0;
    const doneCount = totalCount - remainingCount;

    return (
        <div className="mr-backdrop">
            <div className="mr-card" style={{ position: 'relative' }}>
                {/* Remaining badge — absolute top-right */}
                <span className="mr-remaining-badge mr-remaining-corner">
                    {remainingCount} left
                </span>

                {/* Transaction card */}
                <div className="mr-tx-card">
                    <p className="mr-tx-label">Transaction</p>
                    <p className="mr-tx-desc">{current?.description}</p>
                    <div className="mr-tx-meta">
                        <span>{current?.date}</span>
                        <span className="mr-tx-amount">
                            -{Math.abs(current?.amount || 0).toFixed(2)}
                        </span>
                    </div>
                </div>

                {/* Section header */}
                <div className="mr-section-row">
                    <span className="mr-section-label">Select category</span>
                </div>

                {/* 2-column category grid */}
                <div className="mr-cat-grid">
                    {selectableCategories.map(cat => (
                        <button
                            key={cat}
                            className="mr-cat-btn"
                            onClick={() => onPick(cat)}
                        >
                            <span
                                className="mr-cat-dot"
                                style={{ background: categoryColors?.[cat] || FALLBACK_CATEGORY_COLOR }}
                            />
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div className="mr-footer">
                    <button className="mr-btn mr-btn-secondary" onClick={onSkip}>
                        Skip
                    </button>
                    <button className="mr-btn mr-btn-secondary" onClick={onExit}>
                        Exit Review
                    </button>
                </div>

                {/* Progress bar */}
                <div className="mr-progress-wrap">
                    <div className="mr-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
                {totalCount > 0 && (
                    <p className="mr-progress-label">{doneCount} of {totalCount} reviewed</p>
                )}
            </div>
        </div>
    );
}
