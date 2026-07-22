import { useState, useCallback } from 'react';

export default function StackOrderEditor({ effectiveOrder, isCustomOrder, updateOrder, resetOrder, persist, togglePersist }) {
    const [open, setOpen] = useState(false);

    const moveUp = useCallback((index) => {
        if (index === 0) return;
        const next = [...effectiveOrder];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        updateOrder(next);
    }, [effectiveOrder, updateOrder]);

    const moveDown = useCallback((index) => {
        if (index === effectiveOrder.length - 1) return;
        const next = [...effectiveOrder];
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
        updateOrder(next);
    }, [effectiveOrder, updateOrder]);

    return (
        <div className="stack-order-container">
            <button className="stack-order-toggle" onClick={() => setOpen(o => !o)}>
                Stack order {isCustomOrder ? '(custom)' : '(default)'} {open ? '▲' : '▼'}
            </button>

            {open && (
                <div>
                    <p className="stack-order-hint">Top of list = top of bar. Use ↑ ↓ to reorder.</p>

                    {[...effectiveOrder].reverse().map((cat, reversedIndex) => {
                        const index = effectiveOrder.length - 1 - reversedIndex;
                        return (
                            <div key={cat} className="stack-order-row">
                                <span className="stack-order-label">{cat}</span>
                                <div className="stack-order-buttons">
                                    <button
                                        className="stack-order-btn"
                                        onClick={() => moveDown(index)}
                                        disabled={index === effectiveOrder.length - 1}
                                    >↑</button>
                                    <button
                                        className="stack-order-btn"
                                        onClick={() => moveUp(index)}
                                        disabled={index === 0}
                                    >↓</button>
                                </div>
                            </div>
                        );
                    })}

                    <div className="stack-order-controls">
                        <div className="stack-order-persist-row">
                            <span className="stack-order-persist-label">Remember this order</span>
                            <input
                                type="checkbox"
                                checked={persist}
                                onChange={e => togglePersist(e.target.checked)}
                            />
                        </div>
                        {isCustomOrder && (
                            <button className="stack-order-reset" onClick={resetOrder}>
                                Reset to default
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}