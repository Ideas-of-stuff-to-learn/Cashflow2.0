import { useState, useMemo, useEffect, useCallback } from 'react';
import { getDateRangeInfo } from '../../utils/homescreen/homescreenUtils';
import { getTransactionHistory, getCategories, getUploadCount } from '../../api';
import { useApp } from '../../AppContext';

export function useInitialLoadLogic(){
    const {
        transactions,
        setTransactions,
        setCategories,
        setInitialLoading,
        setInitialLoadError,
        setRetryInitialLoad,
        setAllTransactionsLoaded,
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

    useEffect(() => {
        setRetryInitialLoad(() => retryInitialLoad);
    }, [retryInitialLoad]);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();
        const { signal } = controller;

        setInitialLoadError(null);
        setAllTransactionsLoaded(false);
        setInitialLoading(true);
        setTransactions([]);

        const BATCH_SIZE = 500;

        async function loadInitialData() {
            try {
                const [cats, count] = await Promise.all([
                    getCategories(signal),
                    getUploadCount(signal),
                ]);
                if (cancelled) return;
                setCategories(cats);
                setUploadCount(count);

                let offset = 0;
                let total = null;
                let firstBatch = true;

                while (true) {
                    const page = await getTransactionHistory({ offset, limit: BATCH_SIZE }, signal);
                    if (cancelled) return;

                    total = page.total;
                    setTransactions(prev => {
                        const byId = new Map(prev.map(t => [t.id, t]));
                        for (const t of page.transactions) {
                            byId.set(t.id, t);
                        }
                        return Array.from(byId.values());
                    });

                    if (firstBatch) {
                        setInitialLoading(false);
                        firstBatch = false;
                    }

                    offset += page.transactions.length;
                    if (offset >= total) break;
                }
                if (!cancelled) setAllTransactionsLoaded(true);
            } catch (e) {
                // AbortError is expected/intentional when we cancel on
                // unmount - not a real failure, nothing to show the user.
                if (e.name === 'AbortError') return;
                if (cancelled) return;
                const msg = e.message || '';
                if (msg.includes('starting up')) {
                    setInitialLoadError(msg);
                } else {
                    console.warn('Failed to load initial data:', msg);
                }
            } finally {
                if (!cancelled) setInitialLoading(false);
            }
        }
        loadInitialData();
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [loadRetryCount]);

    return {
        dateRangeInfo,
        uploadCount,
        refetchUploadCount,
        retryInitialLoad,
    };
}