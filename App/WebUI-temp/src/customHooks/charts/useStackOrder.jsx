import { useState, useEffect, useCallback } from 'react';
// AsyncStorage is used for persistence but gracefully degrades when
// unavailable (e.g. Expo Go without a dev build). Stack order still
// works for the session - it just won't survive an app restart until
// running on a real build with the native module present.
// AsyncStorage for persistence - optional. In Expo Go the native module
// isn't available so we skip it entirely. Stack order still works for
// the session, it just won't survive app restarts until running on a
// real/sideloaded build.
let AsyncStorage = null;
try {
    const mod = require('@react-native-async-storage/async-storage');
    // Check the native module is actually present before using it -
    // some versions throw only on first method call, not on import.
    if (mod && mod.default && mod.default.getItem) {
        AsyncStorage = mod.default;
    }
} catch (e) {
    // Not available - persistence disabled silently.
}

function safeStorage(fn) {
    if (!AsyncStorage) return Promise.resolve(null);
    return fn().catch(e => console.warn('AsyncStorage:', e.message));
}

const STORAGE_KEY = 'chartStackOrder';
const PERSIST_KEY = 'chartStackOrderPersist';

// Manages the category stacking order for the charts. The "order" is
// a list of category names - whatever index a name sits at is how high
// it sits in the stacked bar (index 0 = bottom segment, last = top).
// When null, the original categoryNames order from the backend is used.
//
// "Remember this order": a boolean the user controls. When true, the
// current order is written to AsyncStorage and reloaded on next open.
// When false, the order still works for this session but isn't saved.
//
// "Reset to default": always clears both the in-memory order AND any
// saved AsyncStorage entry - so the next open also starts from default.
// Optionally (if `propagateReset` is called with `true`), also removes
// the order from this session immediately - which is what the "Reset"
// button does.
export function useStackOrder(categoryNames) {
    const [stackOrder, setStackOrder] = useState(null);
    const [persist, setPersist] = useState(false);
    const [loaded, setLoaded] = useState(false);

    // Load saved order and persist preference on mount. If category names
    // have changed since the order was saved (a new category was added,
    // or one was deleted via the admin tools), merge gracefully: keep the
    // saved order for categories that still exist, append any new ones at
    // the top.
    useEffect(() => {
        async function load() {
            try {
                const [savedOrder, savedPersist] = await Promise.all([
                    safeStorage(() => AsyncStorage.getItem(STORAGE_KEY)),
                    safeStorage(() => AsyncStorage.getItem(PERSIST_KEY)),
                ]);

                const shouldPersist = savedPersist === 'true';
                setPersist(shouldPersist);

                if (shouldPersist && savedOrder) {
                    const parsed = JSON.parse(savedOrder);
                    // Merge: keep saved positions for names that still exist,
                    // add any new names at the top.
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
        }
        load();
    }, []); // Only on mount - categoryNames isn't stable enough to include here

    // Write to AsyncStorage when order changes AND persist is on.
    useEffect(() => {
        if (!loaded) return;
        if (!persist || !stackOrder) return;
        safeStorage(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stackOrder)));
    }, [stackOrder, persist, loaded]);

    // The effective order: if the user has set a custom order, use it;
    // otherwise fall back to whatever the backend returns (categoryNames).
    // Always filters to only names that currently exist so stale saved
    // names don't appear as ghost segments.
    const effectiveOrder = stackOrder
        ? stackOrder.filter(n => categoryNames.includes(n))
        : categoryNames.filter(n => n !== 'Income');

    const updateOrder = useCallback((newOrder) => {
        setStackOrder(newOrder);
    }, []);

    const togglePersist = useCallback(async (value) => {
        setPersist(value);
        if (value && stackOrder) {
            // Turning ON: save the current order immediately.
            try {
                await safeStorage(() => Promise.all([
                    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stackOrder)),
                    AsyncStorage.setItem(PERSIST_KEY, 'true'),
                ]));
            } catch (e) {
                console.warn('Failed to save stack order:', e.message);
            }
        } else if (!value) {
            // Turning OFF: clear the saved entry (not the in-session order).
            try {
                await safeStorage(() => Promise.all([
                    AsyncStorage.removeItem(STORAGE_KEY),
                    AsyncStorage.setItem(PERSIST_KEY, 'false'),
                ]));
            } catch (e) {
                console.warn('Failed to clear saved stack order:', e.message);
            }
        }
    }, [stackOrder]);

    // Resets the in-session order AND always clears AsyncStorage so the
    // next open also starts from default. This is what the "Reset to
    // default" button calls - there's no option to reset visual only
    // while keeping the saved order, since that would be confusing
    // ("I pressed reset but it comes back on restart").
    const resetOrder = useCallback(async () => {
        setStackOrder(null);
        setPersist(false);
        try {
            await safeStorage(() => Promise.all([
                AsyncStorage.removeItem(STORAGE_KEY),
                AsyncStorage.setItem(PERSIST_KEY, 'false'),
            ]));
        } catch (e) {
            console.warn('Failed to clear saved stack order:', e.message);
        }
    }, []);

    const isCustomOrder = stackOrder !== null;

    return {
        effectiveOrder,   // what the charts actually use
        stackOrder,       // the raw custom order (null = using default)
        updateOrder,      // called by the drag UI with the new sorted list
        resetOrder,       // reset to default + clear AsyncStorage
        persist,
        togglePersist,
        isCustomOrder,    // true when a custom order is active (shows Reset button)
    };
}