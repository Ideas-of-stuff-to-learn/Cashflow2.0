import '../../styles/contentsStyles.css';

// Purely presentational. ManualReviewGate owns all logic and state.
// Deliberately no onClick on the backdrop - must NOT be dismissible by clicking outside.
export default function ManualReviewSequentialModal({
    current, remainingCount, selectableCategories, onPick,
    flushError, flushing, isDone, onRetry,
    onExit, exitConfirmPending, exitFailed, onExitConfirm, onExitCancel,
}) {
    if (flushing || isDone) {
        return (
            <div className="modal-backdrop">
                <div className="modal-card">
                    <p className="modal-desc">{flushing ? 'Saving…' : 'All done!'}</p>
                </div>
            </div>
        );
    }

    if (flushError) {
        return (
            <div className="modal-backdrop">
                <div className="modal-card">
                    <p className="modal-desc">Saving failed. Please check your connection and try again.</p>
                    <button className="modal-option" onClick={onRetry}>
                        <span className="modal-option-text">Retry</span>
                    </button>
                </div>
            </div>
        );
    }

    if (exitConfirmPending) {
        if (exitFailed) {
            return (
                <div className="modal-backdrop">
                    <div className="modal-card modal-card-narrow">
                        <h1 className="modal-title">Something went wrong</h1>
                        <p className="modal-exit-confirm-body">
                            Could not save your picks or move remaining transactions. Please check your connection and try again.
                        </p>
                        <div className="modal-exit-confirm-buttons">
                            <button className="modal-exit-confirm-btn modal-exit-confirm-btn-danger" onClick={onExitConfirm}>
                                Retry exit
                            </button>
                            <button className="modal-exit-confirm-btn modal-exit-confirm-btn-secondary" onClick={onExitCancel}>
                                Go back to categorising
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="modal-backdrop">
                <div className="modal-card modal-card-narrow">
                    <h1 className="modal-title">Exit manual categorisation?</h1>
                    <p className="modal-exit-confirm-body">
                        Exiting gives you access to the rest of the app. Since incomplete data should not be shown,
                        your current picks will be saved and the remaining {remainingCount} transaction{remainingCount !== 1 ? 's' : ''} will
                        be placed in <strong>Other</strong>.
                    </p>
                    <div className="modal-exit-confirm-buttons">
                        <button className="modal-exit-confirm-btn modal-exit-confirm-btn-danger" onClick={onExitConfirm}>
                            Confirm exit
                        </button>
                        <button className="modal-exit-confirm-btn modal-exit-confirm-btn-secondary" onClick={onExitCancel}>
                            Go back to categorising
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="modal-backdrop">
            <div className="modal-card">
                <div className="modal-title-row">
                    <h1 className="modal-title">Categorise this transaction</h1>
                    <span className="modal-remaining-count">
                        {remainingCount} left
                    </span>
                </div>
                <div className='modal-info'>
                    <p className="modal-desc">{current.description}</p>
                    <p className="modal-amount">
                        £{Math.abs(current.amount || 0).toFixed(2)} · {current.date}
                    </p>
                </div>
                <h2>Choose from these categories</h2>
                <div className="modal-list">
                    {selectableCategories.map(cat => (
                        <button
                            key={cat}
                            className="modal-option"
                            onClick={() => onPick(cat)}
                        >
                            <span className="modal-option-text">{cat}</span>
                        </button>
                    ))}
                </div>
                <div className="modal-exit-row">
                    <button className="modal-exit-btn" onClick={onExit}>Exit</button>
                </div>
            </div>
        </div>
    );
}