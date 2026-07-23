import { useState, useEffect } from 'react';
import '../../styles/filterPaneStyles.css';

const POSITION_KEY = 'dashboardFilterPanePosition';
const MINIMIZED_KEY = 'dashboardFilterPaneMinimized';

export default function FilterPane({
    availableCategories,
    contentsSelectedCategories,
    toggleContentsCategory,
    clearContentsCategories,

    effectiveOrder,
    isCustomOrder,
    updateOrder,
    resetOrder,
    persist,
    togglePersist,
}) {
    const [position, setPosition] = useState(() => {
        try { return localStorage.getItem(POSITION_KEY) || 'right'; }
        catch { return 'right'; }
    });
    const [minimized, setMinimized] = useState(() => {
        try { return localStorage.getItem(MINIMIZED_KEY) === 'true'; }
        catch { return false; }
    });

    useEffect(() => {
        try { localStorage.setItem(POSITION_KEY, position); } catch {}
    }, [position]);

    useEffect(() => {
        try { localStorage.setItem(MINIMIZED_KEY, String(minimized)); } catch {}
    }, [minimized]);

    function moveUp(index) {
        if (index === 0) return;
        const next = [...effectiveOrder];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        updateOrder(next);
    }

    function moveDown(index) {
        if (index === effectiveOrder.length - 1) return;
        const next = [...effectiveOrder];
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
        updateOrder(next);
    }

    if (minimized) {
        return (
            <div className={`filter-pane filter-pane-minimized filter-pane-${position}`}>
                <button className="filter-pane-expand-btn" onClick={() => setMinimized(false)}>
                    {position === 'right' ? '◀' : '▶'} Filters
                </button>
            </div>
        );
    }

    return (
        <div className={`filter-pane filter-pane-${position}`}>
            <div className="filter-pane-header">
                <button className="filter-pane-icon-btn" onClick={() => setPosition(p => p === 'right' ? 'left' : 'right')} title="Move panel">
                    {position === 'right' ? '⇤' : '⇥'}
                </button>
                <span className="filter-pane-title">Filters</span>
                <button className="filter-pane-icon-btn" onClick={() => setMinimized(true)} title="Minimize">
                    {position === 'right' ? '▶' : '◀'}
                </button>
            </div>

            <div className="filter-pane-section">
                <p className="filter-pane-section-title">Categories</p>
                <label className="filter-pane-checkbox-row">
                    <input
                        type="checkbox"
                        checked={contentsSelectedCategories.size === 0}
                        onChange={clearContentsCategories}
                    />
                    <span>All</span>
                </label>
                {availableCategories.map(cat => (
                    <label key={cat} className="filter-pane-checkbox-row">
                        <input
                            type="checkbox"
                            checked={contentsSelectedCategories.size === 0 || contentsSelectedCategories.has(cat)}
                            onChange={() => toggleContentsCategory(cat)}
                        />
                        <span>{cat}</span>
                    </label>
                ))}
            </div>

            <div className="filter-pane-section">
                <p className="filter-pane-section-title">
                    Stack order {isCustomOrder ? '(custom)' : '(default)'}
                </p>
                <p className="filter-pane-hint">Top of list = top of bar</p>
                {[...effectiveOrder].reverse().map((cat, reversedIndex) => {
                    const index = effectiveOrder.length - 1 - reversedIndex;
                    return (
                        <div key={cat} className="filter-pane-order-row">
                            <span className="filter-pane-order-label">{cat}</span>
                            <div className="filter-pane-order-buttons">
                                <button
                                    className="filter-pane-order-btn"
                                    onClick={() => moveDown(index)}
                                    disabled={index === effectiveOrder.length - 1}
                                >↑</button>
                                <button
                                    className="filter-pane-order-btn"
                                    onClick={() => moveUp(index)}
                                    disabled={index === 0}
                                >↓</button>
                            </div>
                        </div>
                    );
                })}
                <label className="filter-pane-persist-row">
                    <input type="checkbox" checked={persist} onChange={e => togglePersist(e.target.checked)} />
                    <span>Remember this order</span>
                </label>
                {isCustomOrder && (
                    <button className="filter-pane-reset-btn" onClick={resetOrder}>
                        Reset to default
                    </button>
                )}
            </div>
        </div>
    );
}