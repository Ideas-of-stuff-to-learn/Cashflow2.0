import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { getChartSummary, getMe, getCategories, getUploadCount, getUploadBreakdown, getTransactionHistory } from './api.js';
import { NEEDS_MANUAL_REVIEW } from '../shared/checkingName.js';

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
    const [uploadBreakdown, setUploadBreakdown] = useState({ session_files: [], past_files: [], session_count: 0, past_count: 0 });
    const [loadRetryCount, setLoadRetryCount] = useState(0);

    const [chartDataVersion, setChartDataVersion] = useState(0);
    const bumpChartDataVersion = useCallback(() => {
        setChartDataVersion(t => t + 1);
    }, []);

    // null = no blocking flow active. When active, holds:
    // { totalTransactions, autoResolvedCount, needsReviewCount, needsReviewItems, stage: 'stats'|'sequential' }
    const [manualReviewFlow, setManualReviewFlow] = useState(null);

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [chartSummary, setChartSummary] = useState({ yearly: [], monthly: [] });
    const [userRole, setUserRole] = useState(null);

    // Single shared filter state — charts and contents screens share one set.
    const [selectedCategories, setSelectedCategories] = useState(new Set());
    const seenCategoriesRef = useRef(new Set());

    const toggleCategory = useCallback((cat) => {
        setSelectedCategories(prev => {
            const next = new Set(prev);
            next.has(cat) ? next.delete(cat) : next.add(cat);
            return next;
        });
    }, []);

    const toggleAllCategories = useCallback((allCategoryNames) => {
        setSelectedCategories(prev =>
            prev.size >= allCategoryNames.length ? new Set() : new Set(allCategoryNames)
        );
    }, []);

    // Auto-select newly seen category names as they stream in.
    // Only adds genuinely new names — a category the user unchecked
    // stays unchecked even as later batches introduce unrelated names.
    const categoryNames = categories.map(c => c.name);
    const categoryColors = Object.fromEntries(categories.map(c => [c.name, c.color]));

    useEffect(() => {
        const newlyArrived = categoryNames.filter(name => !seenCategoriesRef.current.has(name));
        if (newlyArrived.length > 0) {
            setSelectedCategories(prev => {
                const next = new Set(prev);
                newlyArrived.forEach(name => next.add(name));
                return next;
            });
            newlyArrived.forEach(name => seenCategoriesRef.current.add(name));
        }
    }, [categoryNames.join(',')]);

    const startManualReviewFlowIfNeeded = useCallback((allProcessedTransactions) => {
        const needsReview = allProcessedTransactions.filter(t => t.category === NEEDS_MANUAL_REVIEW);
        if (needsReview.length === 0) return;
        setManualReviewFlow({
            totalTransactions: allProcessedTransactions.length,
            autoResolvedCount: allProcessedTransactions.length - needsReview.length,
            needsReviewCount: needsReview.length,
            needsReviewItems: needsReview,
            stage: 'stats',
        });
    }, []);

    const enterSequentialReview = useCallback(() => {
        setManualReviewFlow(prev => prev ? { ...prev, stage: 'sequential' } : prev);
    }, []);

    const closeManualReviewFlow = useCallback(() => {
        setManualReviewFlow(null);
    }, []);

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

    // Initial data load — triggered on login and on manual retry.
    // Uses AbortController so in-flight fetches cancel on logout or retry.
    useEffect(() => {
        if (!isLoggedIn) return;

        let cancelled = false;
        const controller = new AbortController();
        const signal = controller.signal;

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
                    // Resume any incomplete manual-review flow from a prior session.
                    setTransactions(currentTransactions => {
                        startManualReviewFlowIfNeeded(currentTransactions);
                        return currentTransactions;
                    });
                }
            } catch (e) {
                if (e.name === 'AbortError' || cancelled) return;
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
            uploadCount,
            refetchUploadCount,
            uploadBreakdown,
            refetchUploadBreakdown,
            chartSummary,
            userRole,
            isLoggedIn,
            completeLogin,
            endSession,
            selectedCategories,
            toggleCategory,
            toggleAllCategories,
            manualReviewFlow,
            setManualReviewFlow,
            startManualReviewFlowIfNeeded,
            enterSequentialReview,
            closeManualReviewFlow,
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    return useContext(AppContext);
}
