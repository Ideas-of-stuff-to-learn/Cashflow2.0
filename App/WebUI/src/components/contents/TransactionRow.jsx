import { memo } from 'react';
import { NEEDS_MANUAL_REVIEW, NOT_YET_CATEGORISED } from '../../checkingName';
import '../../styles/contentsStyles.css';
import { ROW_HEIGHT } from '../../utils/contentsscreen/contentsUtils';

// Extracted as its own file (not just outside ContentsScreen) so
// React.memo works properly - memo does a shallow prop comparison per
// row, and if none of a specific row's props changed, React skips
// re-rendering that row entirely.
//
// Props are either primitives (isSelected, inSelectionMode, index) or
// stable references (item is the same object reference while the
// transaction list is unchanged; onToggle/onOpenPicker are stable
// useCallbacks from useContentsData). That's the contract that makes
// memo's shallow comparison actually skip rows - an inline arrow
// function as a prop would be a new reference every render and defeat
// this entirely.
//
// Press handlers are defined inside the component (not in the parent)
// precisely so they can close over `item` - a stable reference - without
// the parent needing to create a per-item callback that would itself be
// a new reference on every render.

const TransactionRow = memo(function TransactionRow({
    item,
    index,
    isSelected,
    inSelectionMode,
    onToggle,
    onOpenPicker,
    onEnterSelectionMode,
}) {
    const isManual = item.category === NEEDS_MANUAL_REVIEW;
    const isFailed = item.category === NOT_YET_CATEGORISED;
    const isWaiting = !item.category;
    const isPending = isWaiting || isFailed;

    function handleClick() {
        if (isPending) return;
        if (inSelectionMode) {
            onToggle(item.id);
        } else {
            onOpenPicker(item);
        }
    }

    // Web has no native "long press" - closest equivalent is a timer
    // started on mousedown/touchstart, cancelled on mouseup/touchend or
    // if the press is released too soon. This preserves the same
    // "long press to enter selection mode" interaction RN gave you for
    // free via onLongPress.
    let pressTimer = null;
    function handlePressStart() {
        if (isPending) return;
        pressTimer = setTimeout(() => onEnterSelectionMode(item.id), 500);
    }
    function handlePressEnd() {
        if (pressTimer) clearTimeout(pressTimer);
    }

    return (
        <button
            className={[
                'row',
                index % 2 === 0 ? 'row-alt' : '',
                isManual ? 'row-manual' : '',
                isFailed ? 'row-failed' : '',
                isSelected ? 'row-selected' : '',
            ].filter(Boolean).join(' ')}
            onClick={handleClick}
            onMouseDown={handlePressStart}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd}
            onTouchStart={handlePressStart}
            onTouchEnd={handlePressEnd}
            disabled={isPending}
        >
            {inSelectionMode && (
                <div className="checkbox-cell">
                    <div className={`checkbox ${isSelected ? 'checkbox-checked' : ''}`}>
                        {isSelected && <span className="checkbox-mark">✓</span>}
                    </div>
                </div>
            )}
            <span className="cell cell-date">{item.date}</span>
            <span className="cell cell-desc">{item.description}</span>
            <span className="cell cell-amount">£{Math.abs(item.amount || 0).toFixed(2)}</span>
            <span className={[
                'cell', 'cell-cat',
                isManual ? 'cell-manual' : '',
                isWaiting ? 'cell-pending' : '',
                isFailed ? 'cell-failed' : '',
            ].filter(Boolean).join(' ')}>
                {isWaiting ? '...' : isFailed ? '↻ Try again' : item.category}
            </span>
        </button>
    );
});

export default TransactionRow;