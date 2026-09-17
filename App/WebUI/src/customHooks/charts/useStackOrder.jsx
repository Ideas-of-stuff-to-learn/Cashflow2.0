// WebUI/src/customHooks/charts/useStackOrder.jsx
import { useState, useEffect, useCallback } from 'react';
import { useUserPreferences } from '../../appState/UserPreferencesContext';

// Manages the category stacking order for the charts.
// State now lives in UserPreferencesContext (localStorage + server sync).
// The hook's public API is unchanged so StackOrderEditor and useChartData
// need no modifications.
export function useStackOrder(categoryNames) {
    const { stackOrder: savedOrder, setStackOrder, stackPersist: savedPersist, setStackPersist } = useUserPreferences();

    const [stackOrder, _setStackOrder] = useState(() => {
        if (savedPersist && savedOrder) return savedOrder;
        return null;
    });
    const [persist, _setPersist] = useState(savedPersist ?? false);
    const [loaded, setLoaded] = useState(false);

    // Hydrate once from context (already read from localStorage/server).
    // Do NOT filter against categoryNames here — categoryNames is [] on mount
    // (async fetch) and filtering would produce [] permanently since this effect
    // never re-runs. effectiveOrder already filters reactively against categoryNames
    // on every render, so setting the raw saved order is correct.
    useEffect(() => {
        const shouldPersist = savedPersist === true;
        _setPersist(shouldPersist);
        if (shouldPersist && savedOrder && savedOrder.length > 0) {
            _setStackOrder(savedOrder);
        }
        setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Write back to context whenever stackOrder or persist changes (after load)
    useEffect(() => {
        if (!loaded) return;
        if (persist && stackOrder) setStackOrder(stackOrder);
    }, [stackOrder, persist, loaded, setStackOrder]);

    const effectiveOrder = stackOrder
        ? stackOrder.filter(n => categoryNames.includes(n))
        : categoryNames.filter(n => n !== 'Income');

    const updateOrder = useCallback((newOrder) => {
        _setStackOrder(newOrder);
    }, []);

    const togglePersist = useCallback(async (value) => {
        _setPersist(value);
        setStackPersist(value);
        if (value && stackOrder) setStackOrder(stackOrder);
        else if (!value) setStackOrder(null);
    }, [stackOrder, setStackOrder, setStackPersist]);

    const resetOrder = useCallback(async () => {
        _setStackOrder(null);
        _setPersist(false);
        setStackOrder(null);
        setStackPersist(false);
    }, [setStackOrder, setStackPersist]);

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
