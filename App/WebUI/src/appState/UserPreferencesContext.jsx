import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { url as BASE_URL } from '../../../frontendLocalConfig';

// ─── localStorage keys (unchanged from before) ────────────────────────────
const LS_COLUMN_WIDTHS   = 'columnWidths';
const LS_STACK_ORDER     = 'chartStackOrder';
const LS_STACK_PERSIST   = 'chartStackOrderPersist';
const LS_MR_PICKS        = 'mr_pending_picks';

// ─── helpers ──────────────────────────────────────────────────────────────
function lsGet(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
    catch { return fallback; }
}
function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}
function lsDel(key) {
    try { localStorage.removeItem(key); } catch (_) {}
}

// ─── server helpers ────────────────────────────────────────────────────────
// Imported lazily to avoid circular dep; api.jsx is always bundled anyway.
async function serverGet() {
    try {
        const { getPreferences } = await import('../api');
        return await getPreferences();
    } catch { return null; }
}
async function serverPut(patch) {
    try {
        const { putPreferences } = await import('../api');
        await putPreferences(patch);
    } catch (e) {
        console.warn('[UserPrefs] server sync failed:', e.message);
    }
}

// ─── context ──────────────────────────────────────────────────────────────
const UserPreferencesContext = createContext(null);

export function UserPreferencesProvider({ children }) {
    const { isLoggedIn } = useAuth();

    // ── state ──────────────────────────────────────────────────────────────
    const [columnWidths, _setColumnWidths]   = useState(() => lsGet(LS_COLUMN_WIDTHS, {}));
    const [stackOrder,   _setStackOrder]     = useState(() => lsGet(LS_STACK_ORDER, null));
    const [stackPersist, _setStackPersist]   = useState(() => lsGet(LS_STACK_PERSIST, false));
    const [mrPicks,      _setMrPicks]        = useState(() => lsGet(LS_MR_PICKS, null));

    // ── debounce ref for server sync ───────────────────────────────────────
    const syncTimer = useRef(null);
    const pendingPatch = useRef({});

    function scheduleSync(patch) {
        Object.assign(pendingPatch.current, patch);
        if (syncTimer.current) clearTimeout(syncTimer.current);
        syncTimer.current = setTimeout(() => {
            const p = { ...pendingPatch.current };
            pendingPatch.current = {};
            serverPut(p);
        }, 2000);
    }

    // Flush any pending debounced changes immediately — call this after an
    // explicit user intent action (e.g. "Remember this order", "Reset to default")
    // so a quick reload doesn't lose the change before the 2s debounce fires.
    const flushNow = useCallback(() => {
        if (syncTimer.current) {
            clearTimeout(syncTimer.current);
            syncTimer.current = null;
        }
        const p = { ...pendingPatch.current };
        pendingPatch.current = {};
        if (Object.keys(p).length > 0) serverPut(p);
    }, []);

    // ── hydrate from server on login (also handles empty localStorage) ───────
    // Fires when isLoggedIn transitions to true (every page load via AuthContext)
    // and on initial mount if isLoggedIn is already true.
    // Server is authoritative: its values overwrite localStorage and context.
    // If localStorage is already populated, pull anyway so any cross-device
    // changes are reflected. Single serverGet call — no duplicate requests.
    useEffect(() => {
        if (!isLoggedIn) return;
        let cancelled = false;
        serverGet().then(remote => {
            if (cancelled || !remote) return;
            if (remote.columnWidths)         { lsSet(LS_COLUMN_WIDTHS, remote.columnWidths);      _setColumnWidths(remote.columnWidths); }
            if (remote.stackOrder)           { lsSet(LS_STACK_ORDER, remote.stackOrder);           _setStackOrder(remote.stackOrder); }
            if (remote.stackPersist != null) { lsSet(LS_STACK_PERSIST, remote.stackPersist);       _setStackPersist(remote.stackPersist); }
            if (remote.mrPicks)              { lsSet(LS_MR_PICKS, remote.mrPicks);                 _setMrPicks(remote.mrPicks); }
        });
        return () => { cancelled = true; };
    }, [isLoggedIn]);

    // ── flush to server on page unload ─────────────────────────────────────
    // Reads from localStorage (reliable during unload) so nothing is lost
    // if the debounce timer hasn't fired yet. keepalive: true lets the fetch
    // complete even as the page tears down. mrPicks included as a backup —
    // ManualReviewGate's beaconResolveRemainingToOther is a separate concern
    // (it resolves remaining items to Other; this saves the accumulated picks).
    useEffect(() => {
        if (!isLoggedIn) return;
        function handleBeforeUnload() {
            if (syncTimer.current) {
                clearTimeout(syncTimer.current);
                syncTimer.current = null;
            }
            const patch = {};
            const cw = lsGet(LS_COLUMN_WIDTHS, null);
            const so = lsGet(LS_STACK_ORDER, null);
            const sp = lsGet(LS_STACK_PERSIST, null);
            const mr = lsGet(LS_MR_PICKS, null);
            if (cw !== null) patch.columnWidths = cw;
            if (so !== null) patch.stackOrder = so;
            if (sp !== null) patch.stackPersist = sp;
            if (mr !== null) patch.mrPicks = mr;
            if (Object.keys(patch).length === 0) return;
            try {
                fetch(`${BASE_URL}/preferences`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(patch),
                    keepalive: true,
                    credentials: 'include',
                });
            } catch (_) {}
        }
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isLoggedIn]);

    // ── setters (localStorage + state + debounced server) ─────────────────
    const setColumnWidths = useCallback((widths) => {
        _setColumnWidths(widths);
        lsSet(LS_COLUMN_WIDTHS, widths);
        scheduleSync({ columnWidths: widths });
    }, []);

    const setStackOrder = useCallback((order) => {
        _setStackOrder(order);
        if (order !== null) lsSet(LS_STACK_ORDER, order);
        else                lsDel(LS_STACK_ORDER);
        scheduleSync({ stackOrder: order });
    }, []);

    const setStackPersist = useCallback((value) => {
        _setStackPersist(value);
        lsSet(LS_STACK_PERSIST, value);
        scheduleSync({ stackPersist: value });
    }, []);

    const setMrPicks = useCallback((picks) => {
        _setMrPicks(picks);
        if (picks !== null) lsSet(LS_MR_PICKS, picks);
        else                lsDel(LS_MR_PICKS);
        scheduleSync({ mrPicks: picks });
    }, []);

    return (
        <UserPreferencesContext.Provider value={{
            columnWidths, setColumnWidths,
            stackOrder,   setStackOrder,
            stackPersist, setStackPersist,
            mrPicks,      setMrPicks,
            flushNow,
        }}>
            {children}
        </UserPreferencesContext.Provider>
    );
}

export function useUserPreferences() {
    const ctx = useContext(UserPreferencesContext);
    if (!ctx) throw new Error('useUserPreferences must be inside UserPreferencesProvider');
    return ctx;
}
