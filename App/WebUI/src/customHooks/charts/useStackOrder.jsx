// WebUI/src/customHooks/charts/useStackOrder.jsx
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'chartStackOrder';
const PERSIST_KEY = 'chartStackOrderPersist';

// Manages the category stacking order for the charts. The "order" is
// a list of category names - whatever index a name sits at is how high
// it sits in the stacked bar (index 0 = bottom segment, last = top).
// When null, the original categoryNames order from the backend is used.
//
// Web equivalent of the RN version - uses localStorage instead of
// AsyncStorage. localStorage is synchronous, but the function
// signatures below stay async-shaped (still return Promises) so
// nothing calling this hook (StackOrderEditor.jsx, useChartData.jsx)
// needs to change at all.
export function useStackOrder(categoryNames) {
    const [stackOrder, setStackOrder] = useState(null);
    const [persist, setPersist] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        try {
            const savedOrder = localStorage.getItem(STORAGE_KEY);
            const savedPersist = localStorage.getItem(PERSIST_KEY);

            const shouldPersist = savedPersist === 'true';
            setPersist(shouldPersist);

            if (shouldPersist && savedOrder) {
                const parsed = JSON.parse(savedOrder);
                const currentSet = new Set(categoryNames);
                const savedFiltered = parsed.filter(n => currentSet.has(n));
                const savedSet = new Set(savedFiltered);
                const newNames = categoryNames.filter(n => !savedSet.has(n));
                setStackOrder([...savedFiltered, ...newNames]);
            }
        } catch (e) {
            console.warn('Failed to load stack order:', e.message);
        } finally {
            setLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (!loaded) return;
        if (!persist || !stackOrder) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stackOrder));
        } catch (e) {
            console.warn('Failed to save stack order:', e.message);
        }
    }, [stackOrder, persist, loaded]);

    const effectiveOrder = stackOrder
        ? stackOrder.filter(n => categoryNames.includes(n))
        : categoryNames.filter(n => n !== 'Income');

    const updateOrder = useCallback((newOrder) => {
        setStackOrder(newOrder);
    }, []);

    const togglePersist = useCallback(async (value) => {
        setPersist(value);
        try {
            if (value && stackOrder) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(stackOrder));
                localStorage.setItem(PERSIST_KEY, 'true');
            } else if (!value) {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.setItem(PERSIST_KEY, 'false');
            }
        } catch (e) {
            console.warn('Failed to update stack order persistence:', e.message);
        }
    }, [stackOrder]);

    const resetOrder = useCallback(async () => {
        setStackOrder(null);
        setPersist(false);
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.setItem(PERSIST_KEY, 'false');
        } catch (e) {
            console.warn('Failed to clear saved stack order:', e.message);
        }
    }, []);

    const isCustomOrder = stackOrder !== null;

    return {
        effectiveOrder,
        stackOrder,
        updateOrder,
        resetOrder,
        persist,
        togglePersist,
        isCustomOrder,
    };
}