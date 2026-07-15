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
    } = useApp();

    const [uploadCount, setUploadCount] = useState(0);

    const dateRangeInfo = useMemo(() => getDateRangeInfo(transactions), [transactions]);

    // Exposed so HomeScreen can call this right after a fresh upload
    // finishes - the initial fetch below only runs once on mount, so
    // without this, the displayed count would sit stale (showing
    // whatever it was when the app opened) until the app was fully
    // restarted, even though a new upload just changed the real number.
    const refetchUploadCount = useCallback(() => {
        getUploadCount()
            .then(setUploadCount)
            .catch(e => console.warn('Failed to load upload count:', e.message));
    }, []);

    useEffect(() => {
        let cancelled = false;
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
                // Not fatal - user can still upload fresh, just starts
                // from empty instead of restored history/categories
                console.warn('Failed to load initial data:', e.message);
            } finally {
                if (!cancelled) {
                    setInitialLoading(false);
                }
            }
        }
        loadInitialData();
        return () => { cancelled = true; };
    }, []);

    return {
        dateRangeInfo,
        uploadCount,
        refetchUploadCount,
    };
}