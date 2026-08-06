import '../../styles/contentsStyles.css';

// Purely presentational, same pattern as ManualReviewStatsModal - just
// shows whatever CURRENT transaction it's given, and how many remain,
// calling onPick(category) when a category is chosen. Holds no state,
// no list logic, no API calls of its own - all real logic lives in
// ManualReviewGate.jsx, which owns the actual list.
//
// Deliberately no onClick on the backdrop - unlike CategoryResolveModal,
// this one must NOT be dismissible by clicking outside.
export default function ManualReviewSequentialModal({ current, remainingCount, selectableCategories, onPick }) {
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