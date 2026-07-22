import '../../styles/contentsStyles.css';
import { ROW_HEIGHT } from '../../utils/contentsscreen/contentsUtils';

function SortHeader({ label, field, sortField, sortAsc, onToggleSort }) {
    const active = sortField === field;
    return (
        <button onClick={() => onToggleSort(field)} className="header-cell">
            <span className={`header-text ${active ? 'header-text-active' : ''}`}>
                {label} {active ? (sortAsc ? '↑' : '↓') : ''}
            </span>
        </button>
    );
}

export default function TableHeader({ selectionMode, sortField, sortAsc, onToggleSort }) {
    return (
        <div className="table-header">
            {selectionMode && <div className="checkbox-header-spacer" />}
            <SortHeader label="Date" field="date" sortField={sortField} sortAsc={sortAsc} onToggleSort={onToggleSort} />
            <div className="header-cell cell-desc">
                <span className="header-text">Description</span>
            </div>
            <SortHeader label="Amount" field="amount" sortField={sortField} sortAsc={sortAsc} onToggleSort={onToggleSort} />
            <SortHeader label="Category" field="category" sortField={sortField} sortAsc={sortAsc} onToggleSort={onToggleSort} />
        </div>
    );
}