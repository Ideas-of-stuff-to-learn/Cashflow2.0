import '../../styles/contentsStyles.css';
import { ROW_HEIGHT } from '../../utils/contentsscreen/contentsUtils';

export default function SelectionBar({
    selectedCount,
    onCancel,
    onSelectAll,
    onDeselectAll,
    onChangeCategory,
    onDelete,
    deleting,
}) {
    return (
        <div className="selection-bar">
            <div className="selection-top-row">
                <span className="selection-text">{selectedCount} selected</span>
                <button className="selection-button" onClick={onCancel}>
                    <span className="selection-button-text">Cancel</span>
                </button>
            </div>
            <div className="selection-bottom-row">
                <button className="selection-button-small" onClick={onSelectAll}>
                    <span className="selection-button-text-small">Select All</span>
                </button>
                <button className="selection-button-small" onClick={onDeselectAll}>
                    <span className="selection-button-text-small">Deselect All</span>
                </button>
                <button
                    className={`selection-button-small selection-button-primary ${selectedCount === 0 ? 'selection-button-disabled' : ''}`}
                    onClick={onChangeCategory}
                    disabled={selectedCount === 0}
                >
                    <span className="selection-button-text-primary">Change category</span>
                </button>
                <button
                    className={`selection-button-small selection-button-danger ${(selectedCount === 0 || deleting) ? 'selection-button-disabled' : ''}`}
                    onClick={onDelete}
                    disabled={selectedCount === 0 || deleting}
                >
                    <span className="selection-button-text-danger">Delete</span>
                </button>
            </div>
        </div>
    );
}