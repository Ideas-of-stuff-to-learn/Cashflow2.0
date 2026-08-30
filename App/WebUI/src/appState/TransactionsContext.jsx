import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { getCategories, getUploadCount, getUploadBreakdown, getTransactionHistory } from '../api';
import { useAuth } from './AuthContext';
import { useProcessing } from './ProcessingContext';

const TransactionsContext = createContext();

export function TransactionsProvider({ children }) {
    const { isLoggedIn } = useAuth();
    const { startManualReviewFlowIfNeeded } = useProcessing();

    const [transactions, setTransactions] = useState([]);
    const [categories, setCategories] = useState([]);
    const [uploadCount, setUploadCount] = useState(0);
    const [uploadBreakdown, setUploadBreakdown] = useState({ session_files: [], past_files: [], session_count: 0, past_count: 0 });
    const [initialLoading, setInitialLoading] = useState(true);
    const [allTransactionsLoaded, setAllTransactionsLoaded] = useState(false);
    const [initialLoadError, setInitialLoadError] = useState(null);
    const [loadRetryCount, setLoadRetryCount] = useState(0);

    const categoryNames = useMemo(() => categories.map(c => c.name), [categories]);
    const categoryColors = useMemo(() => Object.fromEntries(categories.map(c => [c.name, c.color])), [categories]);

    const retryInitialLoad = useCallback(() => {
        setLoadRetryCount(c => c + 1);
    }, []);

    const refetchUploadCount = useCallback(() => {
        getUploadCount()
            .then(setUploadCount)
            .catch(e => console.warn('Failed to load upload count:', e.message));
    }, []);

    const refetchUploadBreakdown = useCallback(() => {
        getUploadBreakdown()
            .then(setUploadBreakdown)
            .catch(e => console.warn('Failed to load upload breakdown:', e.message));
    }, []);

    useEffect(() => {
        if (!isLoggedIn) return;

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
                const [cats, count, breakdown] = await Promise.all([
                    getCategories(signal),
                    getUploadCount(signal),
                    getUploadBreakdown(),
                ]);
                if (cancelled) return;
                setCategories(cats);
                setUploadCount(count);
                setUploadBreakdown(breakdown);

                let offset = 0;
                let total = null;
                let firstBatch = true;

                while (true) {
                    const page = await getTransactionHistory({ offset, limit: BATCH_SIZE }, signal);
                    if (cancelled) return;

                    total = page.total;
                    setTransactions(prev => {
                        const byId = new Map(prev.map(t => [t.id, t]));
                        for (const t of page.transactions) byId.set(t.id, t);
                        return Array.from(byId.values());
                    });

                    if (firstBatch) {
                        setInitialLoading(false);
                        firstBatch = false;
                    }

                    offset += page.transactions.length;
                    if (offset >= total) break;
                }

                if (!cancelled) {
                    setAllTransactionsLoaded(true);
                    setTransactions(current => {
                        startManualReviewFlowIfNeeded(current);
                        return current;
                    });
                }
            } catch (e) {
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
    }, [isLoggedIn, loadRetryCount, startManualReviewFlowIfNeeded]);

    return (
        <TransactionsContext.Provider value={{
            transactions, setTransactions,
            categories, setCategories,
            categoryNames, categoryColors,
            uploadCount, setUploadCount,
            uploadBreakdown, setUploadBreakdown,
            initialLoading, setInitialLoading,
            allTransactionsLoaded, setAllTransactionsLoaded,
            initialLoadError, setInitialLoadError,
            retryInitialLoad, refetchUploadCount, refetchUploadBreakdown,
        }}>
            {children}
        </TransactionsContext.Provider>
    );
}

export function useTransactions() {
    return useContext(TransactionsContext);
}
