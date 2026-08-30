import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { getChartSummary, getMe, getCategories, getUploadCount, getUploadBreakdown, getTransactionHistory } from './api';
import { NEEDS_MANUAL_REVIEW } from './checkingName';

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
    const [manualReviewFlow, setManualReviewFlow] = useState(null);

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [chartSummary, setChartSummary] = useState({ yearly: [], monthly: [] });
    const [userRole, setUserRole] = useState(null);

    // Standard checkbox-list semantics: selectedCategories genuinely
    // CONTAINS every category currently visible - checking a box adds
    // it, unchecking removes it. No special "empty means show
    // everything" case anymore - an empty set now honestly means
    // "nothing selected/shown." This replaces the old inclusion-list +
    // sentinel-marker model, which couldn't cleanly express "deselect
    // just this one category, leave everything else visible."
    //
    // Two GENUINELY SEPARATE filter states, per today's design
    // decision: contentsSelectedCategories is shared by Dashboard's
    // FilterPane, Dashboard's own chart (mirrored via a one-way effect
    // in Dashboard.jsx), and ContentsScreen WHEN VIEWED AT DESKTOP
    // WIDTH. mobileSelectedCategories is shared by the phone-mimic
    // ChartsScreen and ContentsScreen WHEN VIEWED AT MOBILE WIDTH -
    // which of the two ContentsScreen actually reads/writes is decided
    // by ContentsScreen's own useIsMobile() check, not by which button
    // was clicked to navigate there.
    const [contentsSelectedCategories, setContentsSelectedCategories] = useState(new Set());
    const seenContentsCategoriesRef = useRef(new Set());

    const [mobileSelectedCategories, setMobileSelectedCategories] = useState(new Set());
    const seenMobileCategoriesRef = useRef(new Set());

    const toggleContentsCategory = useCallback((cat) => {
        setContentsSelectedCategories(prev => {
            const next = new Set(prev);
            next.has(cat) ? next.delete(cat) : next.add(cat);
            return next;
        });
    }, []);


    // null = no blocking flow active. When active, holds:
    // {
    //   totalTransactions: number,      // how many were in this upload/run
    //   autoResolvedCount: number,      // how many were auto-categorised
    //   needsReviewCount: number,       // how many need manual input
    //   stage: 'stats' | 'sequential',  // which modal is currently showing
    // }

    // Called by useFileProcessor once a categorisation run genuinely
    // finishes - checks whether any transactions are sitting at
    // NEEDS_MANUAL_REVIEW, and if so, kicks off the blocking flow. This
    // lives in AppContext (not either screen) since categorisation can be
    // triggered from Dashboard OR HomeScreen, and the blocking overlay
    // needs to work regardless of which one triggered it.
    const startManualReviewFlowIfNeeded = useCallback((allProcessedTransactions) => {
        const needsReview = allProcessedTransactions.filter(t => t.category === NEEDS_MANUAL_REVIEW);
        if (needsReview.length === 0) return;

        setManualReviewFlow({
            totalTransactions: allProcessedTransactions.length,
            autoResolvedCount: allProcessedTransactions.length - needsReview.length,
            needsReviewCount: needsReview.length,
            // NEW - the actual full transaction objects still needing
            // review, not just the count - both the bulk "Put in Other"
            // call and the sequential one-by-one modal need real
            // description/date/amount to send to /categorize/resolve.
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
    // "All" toggle - fills the set with every given category name, or
    // empties it entirely, based on whether it's CURRENTLY full.
    // allCategoryNames is passed in at call time (not read from
    // context state directly) since this function doesn't know or
    // care about the availableCategories/Income-exclusion distinction
    // - that filtering happens in useChartData, one layer up.
    const toggleAllContentsCategories = useCallback((allCategoryNames) => {
        setContentsSelectedCategories(prev =>
            prev.size >= allCategoryNames.length ? new Set() : new Set(allCategoryNames)
        );
    }, []);

    const toggleMobileCategory = useCallback((cat) => {
        setMobileSelectedCategories(prev => {
            const next = new Set(prev);
            next.has(cat) ? next.delete(cat) : next.add(cat);
            return next;
        });
    }, []);

    const toggleAllMobileCategories = useCallback((allCategoryNames) => {
        setMobileSelectedCategories(prev =>
            prev.size >= allCategoryNames.length ? new Set() : new Set(allCategoryNames)
        );
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
                if (!cancelled) {
                    setAllTransactionsLoaded(true);
                    // Resume the manual-review flow if the account has any
                    // NEEDS_MANUAL_REVIEW transactions left over from an incomplete
                    // previous session (reload, closed tab, auto/manual re-login) -
                    // reuses the SAME function a fresh categorisation run triggers,
                    // just fed the full freshly-loaded transaction list instead of
                    // just one run's items.
                    setTransactions(currentTransactions => {
                        startManualReviewFlowIfNeeded(currentTransactions);
                        return currentTransactions;
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
    }, [isLoggedIn, loadRetryCount]);

    const categoryNames = categories.map(c => c.name);
    const categoryColors = Object.fromEntries(categories.map(c => [c.name, c.color]));

    // As new category names stream in (batch by batch, during
    // categorisation), auto-select each genuinely NEW name in BOTH
    // filter states - but only ones never seen before, so a category
    // the user has manually unchecked stays unchecked even as later,
    // unrelated batches introduce other new category names.
    useEffect(() => {
        const newlyArrived = categoryNames.filter(name =>
            !seenContentsCategoriesRef.current.has(name)
        );
        if (newlyArrived.length > 0) {
            setContentsSelectedCategories(prev => {
                const next = new Set(prev);
                newlyArrived.forEach(name => next.add(name));
                return next;
            });
            newlyArrived.forEach(name => seenContentsCategoriesRef.current.add(name));
        }
    }, [categoryNames]);

    useEffect(() => {
        const newlyArrived = categoryNames.filter(name =>
            !seenMobileCategoriesRef.current.has(name)
        );
        if (newlyArrived.length > 0) {
            setMobileSelectedCategories(prev => {
                const next = new Set(prev);
                newlyArrived.forEach(name => next.add(name));
                return next;
            });
            newlyArrived.forEach(name => seenMobileCategoriesRef.current.add(name));
        }
    }, [categoryNames]);

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

    const contextValue = useMemo(() => ({
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
        uploadBreakdown,
        refetchUploadBreakdown,
        chartSummary,
        userRole,
        isLoggedIn,
        completeLogin,
        endSession,
        uploadCount,
        refetchUploadCount,
        contentsSelectedCategories,
        toggleContentsCategory,
        toggleAllContentsCategories,
        mobileSelectedCategories,
        toggleMobileCategory,
        toggleAllMobileCategories,
        manualReviewFlow,
        setManualReviewFlow,
        startManualReviewFlowIfNeeded,
        enterSequentialReview,
        closeManualReviewFlow,
    }), [
        transactions, categorising, parseError, categories, categoryNames, categoryColors,
        initialLoading, allTransactionsLoaded, initialLoadError, retryInitialLoad,
        processingStage, chartDataVersion, bumpChartDataVersion,
        uploadBreakdown, refetchUploadBreakdown, chartSummary, userRole,
        isLoggedIn, completeLogin, endSession, uploadCount, refetchUploadCount,
        contentsSelectedCategories, toggleContentsCategory, toggleAllContentsCategories,
        mobileSelectedCategories, toggleMobileCategory, toggleAllMobileCategories,
        manualReviewFlow, startManualReviewFlowIfNeeded, enterSequentialReview, closeManualReviewFlow,
    ]);

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    return useContext(AppContext);
}