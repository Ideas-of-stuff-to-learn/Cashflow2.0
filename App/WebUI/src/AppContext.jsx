import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { getChartSummary, getMe, getCategories, getUploadCount, getUploadBreakdown, getTransactionHistory } from './api';

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
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    return useContext(AppContext);
}