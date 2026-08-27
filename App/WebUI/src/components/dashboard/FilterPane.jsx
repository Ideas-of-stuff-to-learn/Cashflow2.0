import { useState, useEffect } from 'react';
import '../../styles/filterPaneStyles.css';

const MINIMIZED_KEY = 'dashboardFilterPaneMinimized';

export default function FilterPane({
    availableCategories,
    contentsSelectedCategories,
    toggleContentsCategory,
    toggleAllContentsCategories,
    categoryColors,

    effectiveOrder,
    isCustomOrder,
    updateOrder,
    resetOrder,
    persist,
    togglePersist,
}) {
    const [minimized, setMinimized] = useState(() => {
        try { return localStorage.getItem(MINIMIZED_KEY) === 'true'; }
        catch { return false; }
    });
    const [dragIndex, setDragIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);

    useEffect(() => {
        try { localStorage.setItem(MINIMIZED_KEY, String(minimized)); } catch {}
    }, [minimized]);

    // Displayed top-to-bottom, so the row a person sees at the top is
    // the top (last-drawn) segment of the stacked bar - the reverse of
    // effectiveOrder, which is bottom-of-bar-first.
    const displayOrder = [...effectiveOrder].reverse();

    function handleDrop(dropIndex) {
        if (dragIndex === null || dragIndex === dropIndex) {
            setDragIndex(null);
            setDragOverIndex(null);
            return;
        }
        const next = [...displayOrder];
        const [moved] = next.splice(dragIndex, 1);
        next.splice(dropIndex, 0, moved);
        updateOrder([...next].reverse());
        setDragIndex(null);
        setDragOverIndex(null);
    }

    // Standard checkbox-list semantics: "All" is checked when the set
    // genuinely contains every available category, not on emptiness.
    const allSelected = availableCategories.every(cat => contentsSelectedCategories.has(cat));

    return (
        <div className={`filter-pane filter-pane-right${minimized ? ' filter-pane-collapsed' : ''}`}>
            <div className="filter-pane-header">
                <span className="filter-pane-title">Filters</span>
                <button
                    className="filter-pane-icon-btn"
                    onClick={() => setMinimized(m => !m)}
                    title={minimized ? 'Expand' : 'Collapse'}
                >
                    {minimized ? '▼' : '▲'}
                </button>
            </div>

            {!minimized && (
            <div className="filter-pane-section">
                <p className="filter-pane-section-title">
                    Categories {isCustomOrder ? '(custom order)' : ''}
                </p>
                <p className="filter-pane-hint">Drag to reorder — top of list = top of bar</p>
                <label className="filter-pane-checkbox-row">
                    <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => toggleAllContentsCategories(availableCategories)}
                    />
                    <span>All</span>
                </label>

                <div className="filter-pane-scroll-list">
                    {displayOrder.map((cat, index) => (
                        <div
                            key={cat}
                            className={`filter-pane-combined-row${dragOverIndex === index ? ' filter-pane-drag-over' : ''}`}
                            onDragOver={e => { e.preventDefault(); setDragOverIndex(index); }}
                            onDragLeave={() => setDragOverIndex(o => (o === index ? null : o))}
                            onDrop={() => handleDrop(index)}
                        >
                            <label className="filter-pane-checkbox-row filter-pane-combined-label">
                                <input
                                    type="checkbox"
                                    checked={contentsSelectedCategories.has(cat)}
                                    onChange={() => toggleContentsCategory(cat)}
                                />
                                <span className="filter-pane-colour-dot" style={{ backgroundColor: categoryColors?.[cat] || '#BBBBBB' }} />
                                <span>{cat}</span>
                            </label>
                            <span
                                className="filter-pane-drag-handle"
                                draggable
                                onDragStart={() => setDragIndex(index)}
                                onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                                title="Drag to reorder"
                            >
                                ☰
                            </span>
                        </div>
                    ))}
                </div>

                <div style={{ flexShrink: 0 }}>
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
            )}
        </div>
    );
}