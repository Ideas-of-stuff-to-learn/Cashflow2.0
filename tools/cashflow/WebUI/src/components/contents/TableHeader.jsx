import { useRef, useCallback, useEffect } from 'react';
import '../../styles/contentsStyles.css';

const COLS = ['date', 'desc', 'amount', 'cat'];

function getColVar(col) {
    return getComputedStyle(document.documentElement).getPropertyValue(`--col-${col}`).trim();
}

function setColVar(col, px) {
    document.documentElement.style.setProperty(`--col-${col}`, `0 0 ${Math.round(px)}px`);
}

function readWidths() {
    const vals = {};
    COLS.forEach(c => {
        const raw = getColVar(c);
        const match = raw.match(/(\d+(?:\.\d+)?)px/);
        vals[c] = match ? Math.round(Number(match[1])) : null;
    });
    return vals;
}

function logWidths(label = 'after drag') {
    const vals = readWidths();
    const pretty = Object.fromEntries(
        Object.entries(vals).map(([k, v]) => [k, v != null ? `${v}px` : 'flex'])
    );
    console.log(`%c[COLUMN WIDTHS – ${label}]`, 'color:#2E5C8A;font-weight:bold', JSON.stringify(pretty));
    console.log('%cPaste this to set defaults:', 'color:#888', JSON.stringify(vals));
    return vals;
}

function ResizeHandle({ col, onSave }) {
    const dragRef = useRef(null);

    const onPointerDown = useCallback((e) => {
        if (e.button !== undefined && e.button !== 0 && !e.touches) return;
        e.preventDefault();
        e.stopPropagation();

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const cellEl = e.currentTarget.parentElement;
        const startWidth = cellEl.getBoundingClientRect().width;

        // Ensure desc/cat are fixed at their current pixel width before dragging
        const current = getColVar(col);
        if (!current) setColVar(col, startWidth);

        dragRef.current = { startX: clientX, startWidth };

        const onMove = (ev) => {
            if (ev.cancelable) ev.preventDefault();
            const x = ev.touches ? ev.touches[0].clientX : ev.clientX;
            const delta = x - dragRef.current.startX;
            setColVar(col, Math.max(30, dragRef.current.startWidth + delta));
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);
            const vals = logWidths();
            if (onSave) onSave(vals);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
    }, [col, onSave]);

    return (
        <div
            className="col-resize-handle"
            onMouseDown={onPointerDown}
            onTouchStart={onPointerDown}
            onClick={e => e.stopPropagation()}
        />
    );
}

function SortHeader({ label, field, col, sortField, sortAsc, onToggleSort, className, onSave }) {
    const active = sortField === field;
    return (
        <button onClick={() => onToggleSort(field)} className={className} style={{ position: 'relative' }}>
            <span className={`header-text ${active ? 'header-text-active' : ''}`}>
                {label}{active ? ` ${sortAsc ? '↑' : '↓'}` : ''}
            </span>
            <ResizeHandle col={col} onSave={onSave} />
        </button>
    );
}

export default function TableHeader({ selectionMode, sortField, sortAsc, onToggleSort, columnWidths, setColumnWidths, isMobile }) {

    // Clear any stale inline CSS vars from a previous surface (e.g. desktop widths
    // bleeding into mobile), then apply saved widths for this surface.
    useEffect(() => {
        COLS.forEach(col => document.documentElement.style.removeProperty(`--col-${col}`));
        if (columnWidths && typeof columnWidths === 'object') {
            COLS.forEach(col => {
                const px = columnWidths[col];
                if (px != null) setColVar(col, px);
            });
        }
        logWidths('page load – current state');
    }, [isMobile]); // re-run on resize so stale vars from the other surface are cleared

    return (
        <div className="table-header">
            {selectionMode && <div className="checkbox-header-spacer" />}
            <SortHeader
                label="Date" field="date" col="date"
                sortField={sortField} sortAsc={sortAsc} onToggleSort={onToggleSort}
                className="header-cell cell-date"
                onSave={setColumnWidths}
            />
            <div className="header-cell cell-desc" style={{ position: 'relative' }}>
                <span className="header-text">Description</span>
                <ResizeHandle col="desc" onSave={setColumnWidths} />
            </div>
            <SortHeader
                label="Amount" field="amount" col="amount"
                sortField={sortField} sortAsc={sortAsc} onToggleSort={onToggleSort}
                className="header-cell cell-amount"
                onSave={setColumnWidths}
            />
            <SortHeader
                label="Category" field="category" col="cat"
                sortField={sortField} sortAsc={sortAsc} onToggleSort={onToggleSort}
                className="header-cell cell-cat"
                onSave={setColumnWidths}
            />
        </div>
    );
}
