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

        const BATCH_SIZE = 500;

        async function loadInitialData() {
            try {
                // Step 1: categories and upload count first - these are
                // small, fast requests that make the home screen info
                // (date range, upload count) appear immediately. Fetched
                // in parallel since they're independent.
                const [cats, count] = await Promise.all([
                    getCategories(),
                    getUploadCount(),
                ]);
                if (cancelled) return;
                setCategories(cats);
                setUploadCount(count);

                // Step 2: transactions in batches. The first batch makes
                // the Contents/Charts screens usable right away (and the
                // date range on home updates as each batch lands). Remaining
                // batches stream in progressively. setInitialLoading(false)
                // fires after the first batch so UI spinners clear as soon
                // as something is visible, not after all thousands of rows.
                let offset = 0;
                let total = null;
                let firstBatch = true;

                while (true) {
                    const page = await getTransactionHistory({
                        offset,
                        limit: BATCH_SIZE,
                    });
                    if (cancelled) return;

                    total = page.total;
                    setTransactions(prev => {
                        // Merge rather than replace - preserves any
                        // rows added by an upload that happened to land
                        // while a long batch-load was still in progress.
                        const byId = new Map(prev.map(t => [t.id, t]));
                        for (const t of page.transactions) {
                            byId.set(t.id, t);
                        }
                        return Array.from(byId.values());
                    });

                    if (firstBatch) {
                        // Clear the loading spinner after the first batch
                        // so the UI is usable immediately, even if more
                        // batches are still coming.
                        setInitialLoading(false);
                        firstBatch = false;
                    }

                    offset += page.transactions.length;
                    if (offset >= total) break;
                }
            } catch (e) {
                if (cancelled) return;
                const msg = e.message || '';
                if (msg.includes('starting up')) {
                    setInitialLoadError(msg);
                } else {
                    console.warn('Failed to load initial data:', msg);
                }
            } finally {
                // Always clear the loading spinner on exit, even if
                // the first batch never landed (error path).
                if (!cancelled) setInitialLoading(false);
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