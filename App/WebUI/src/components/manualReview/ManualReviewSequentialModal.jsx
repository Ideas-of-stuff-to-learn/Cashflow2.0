import '../../styles/contentsStyles.css';

// Purely presentational. ManualReviewGate owns all logic and state.
// Deliberately no onClick on the backdrop - must NOT be dismissible by clicking outside.
export default function ManualReviewSequentialModal({
    current, remainingCount, selectableCategories, onPick,
    flushError, flushing, isDone, onRetry,
}) {
    if (flushing || isDone) {
        return (
            <div className="modal-backdrop">
                <div className="modal-card">
                    <p className="modal-desc">{flushing ? 'Saving your categories…' : 'All done!'}</p>
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
            </div>
        </div>
    );
}