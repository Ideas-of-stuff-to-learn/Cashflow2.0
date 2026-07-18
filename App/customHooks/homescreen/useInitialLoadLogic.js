import { useState, useMemo, useEffect, useCallback } from 'react';
import { getDateRangeInfo } from '../../utils/homescreen/homescreenUtils.js';
import { getTransactionHistory, getCategories, getUploadCount } from '../../api.js';
import { useApp } from '../../AppContext.js';

export function useInitialLoadLogic(){
    const {
        transactions,
        setTransactions,
        setCategories,
        setInitialLoading,
        setInitialLoadError,
        setRetryInitialLoad,
    } = useApp();

    const [uploadCount, setUploadCount] = useState(0);
    const [loadRetryCount, setLoadRetryCount] = useState(0);

    const dateRangeInfo = useMemo(() => getDateRangeInfo(transactions), [transactions]);

    const refetchUploadCount = useCallback(() => {
        getUploadCount()
            .then(setUploadCount)
            .catch(e => console.warn('Failed to load upload count:', e.message));
    }, []);

    const retryInitialLoad = useCallback(() => {
        setLoadRetryCount(c => c + 1);
    }, []);

    // Register retryInitialLoad into context immediately on mount so
    // ContentsScreen (and any future screen) can call it via useApp()
    // without needing to import this hook directly.
    useEffect(() => {
        setRetryInitialLoad(() => retryInitialLoad);
    }, [retryInitialLoad]);

    useEffect(() => {
        let cancelled = false;
        setInitialLoadError(null);

        async function loadInitialData() {
            try {
                // Fetch in parallel - unrelated data, no reason to wait
                // on one before starting the other
                const [history, cats, count] = await Promise.all([
                    getTransactionHistory(),
                    getCategories(),
                    getUploadCount(),
                ]);
                if (!cancelled) {
                    setTransactions(history);
                    setCategories(cats);
                    setUploadCount(count);
                }
            } catch (e) {
                if (cancelled) return;
                const msg = e.message || '';
                if (msg.includes('starting up')) {
                    // Cold-start timeout - surface to UI so user sees
                    // a message + retry button rather than just a
                    // spinner that never resolves.
                    setInitialLoadError(msg);
                } else {
                    // Other failure - not fatal, user can still upload
                    // fresh data, just starts from empty instead of
                    // restored history/categories.
                    console.warn('Failed to load initial data:', msg);
                }
            } finally {
                if (!cancelled) {
                    setInitialLoading(false);
                }
            }
        }
        loadInitialData();
        return () => { cancelled = true; };
    }, [loadRetryCount]);

    return {
        dateRangeInfo,
        uploadCount,
        refetchUploadCount,
        retryInitialLoad,
    };
}