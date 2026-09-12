import '../../styles/contentsStyles.css';

export default function SelectionBar({
    selectedCount,
    onCancel,
    onSelectAll,
    onDeselectAll,
    onChangeCategory,
    onDelete,
    deleting,
}) {
    const hasSelection = selectedCount > 0;

    return (
        <div className="cs-sel-bar">
            <span className="cs-sel-count">{selectedCount} selected</span>
            <div className="cs-sel-divider" />
            <button className="cs-sel-btn-ghost" onClick={onSelectAll}>Select all</button>
            <button
                className="cs-sel-btn-ghost"
                onClick={onDeselectAll}
                disabled={!hasSelection}
                style={!hasSelection ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
            >
                Deselect all
            </button>
            <button
                className={`cs-sel-btn-primary${!hasSelection ? ' cs-sel-btn-off' : ''}`}
                onClick={onChangeCategory}
                disabled={!hasSelection}
            >
                Change category
            </button>
            <button
                className={`cs-sel-btn-danger${(!hasSelection || deleting) ? ' cs-sel-btn-off' : ''}`}
                onClick={onDelete}
                disabled={!hasSelection || deleting}
            >
                {deleting ? 'Deleting…' : 'Delete'}
            </button>
            <button className="cs-sel-btn-cancel" onClick={onCancel}>✕ Cancel</button>
        </div>
    );
}
