import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { getChartSummary, getMe, getCategories, getUploadCount, getTransactionHistory } from './api';

const AppContext = createContext();

export function AppProvider({ children }) {
    const [transactions, setTransactions] = useState([]);
    const [categorising, setCategorising] = useState(false);
    const [parseError, setParseError] = useState(null);
    const [categories, setCategories] = useState([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [allTransactionsLoaded, setAllTransactionsLoaded] = useState(false);
    const [initialLoadError, setInitialLoadError] = useState(null);
    const [processingStage, setProcessingStage] = useState('idle');
    const [uploadCount, setUploadCount] = useState(0);
    // Same purpose as before - bump to force a refetch (e.g. the Retry
    // button). Now lives at provider level since the fetch itself does.
    const [loadRetryCount, setLoadRetryCount] = useState(0);

    const [chartDataVersion, setChartDataVersion] = useState(0);
    const bumpChartDataVersion = useCallback(() => {
        setChartDataVersion(t => t + 1);
    }, []);

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [chartSummary, setChartSummary] = useState({ yearly: [], monthly: [] });
    const [userRole, setUserRole] = useState(null);
    const [contentsSelectedCategories, setContentsSelectedCategories] = useState(new Set());

    const toggleContentsCategory = useCallback((cat) => {
        setContentsSelectedCategories(prev => {
            const next = new Set(prev);
            next.has(cat) ? next.delete(cat) : next.add(cat);
            return next;
        });
    }, []);

    const clearContentsCategories = useCallback(() => {
        setContentsSelectedCategories(new Set());
    }, []);

    const retryInitialLoad = useCallback(() => {
        setLoadRetryCount(c => c + 1);
    }, []);

    const refetchUploadCount = useCallback(() => {
        getUploadCount()
            .then(setUploadCount)
            .catch(e => console.warn('Failed to load upload count:', e.message));
    }, []);

    useEffect(() => {
        if (!isLoggedIn) return;

        let cancelled = false;
        getMe()
            .then(data => { if (!cancelled) setUserRole(data); })
            .catch(e => console.warn('Failed to load role info:', e.message));

        return () => { cancelled = true; };
    }, [isLoggedIn]);

    useEffect(() => {
        if (!isLoggedIn) return;

        let cancelled = false;

        async function fetchWithRetry(attempt = 1) {
            try {
                const data = await getChartSummary();
                if (!cancelled) setChartSummary(data);
            } catch (e) {
                if (attempt >= 3) {
                    console.warn(`Failed to load chart summary after ${attempt} attempts:`, e.message);
                    return;
                }
                const delayMs = 1000 * attempt;
                await new Promise(resolve => setTimeout(resolve, delayMs));
                if (!cancelled) await fetchWithRetry(attempt + 1);
            }
        }

        fetchWithRetry();

        return () => { cancelled = true; };
    }, [chartDataVersion, isLoggedIn]);

    // Moved here from useInitialLoadLogic.js - gated on isLoggedIn (not
    // tied to HomeScreen's mount), same reasoning as chartSummary above:
    // this now runs ONCE per login (or on retryInitialLoad/loadRetryCount
    // bump), not once per Home screen mount. Navigating Home <-> Charts
    // <-> Contents no longer refetches anything, since AppProvider - and
    // this effect - stay mounted for the whole app lifetime.
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
    }, [isLoggedIn, loadRetryCount]);

    const categoryNames = categories.map(c => c.name);
    const categoryColors = Object.fromEntries(categories.map(c => [c.name, c.color]));

    const lastLoggedInUsernameRef = useRef(null);

    const completeLogin = useCallback((username) => {
        if (username !== lastLoggedInUsernameRef.current) {
            setChartSummary({ yearly: [], monthly: [] });
            setTransactions([]);
            setCategories([]);
            setUserRole(null);
        }
        lastLoggedInUsernameRef.current = username;
        setIsLoggedIn(true);
    }, []);

    const endSession = useCallback(() => {
        setIsLoggedIn(false);
    }, []);

    return (
        <AppContext.Provider value={{
            transactions,
            setTransactions,
            categorising,
            setCategorising,
            parseError,
            setParseError,
            categories,
            setCategories,
            categoryNames,
            categoryColors,
            initialLoading,
            setInitialLoading,
            allTransactionsLoaded,
            setAllTransactionsLoaded,
            initialLoadError,
            setInitialLoadError,
            retryInitialLoad,
            processingStage,
            setProcessingStage,
            chartDataVersion,
            bumpChartDataVersion,
            chartSummary,
            userRole,
            isLoggedIn,
            completeLogin,
            endSession,
            uploadCount,
            refetchUploadCount,
            contentsSelectedCategories,
            toggleContentsCategory,
            clearContentsCategories,
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    return useContext(AppContext);
}