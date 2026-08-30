import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { getChartSummary } from '../api';
import { useAuth } from './AuthContext';
import { useTransactions } from './TransactionsContext';

const ChartFilterContext = createContext();

export function ChartFilterProvider({ children }) {
    const { isLoggedIn } = useAuth();
    const { categoryNames } = useTransactions();

    const [chartSummary, setChartSummary] = useState({ yearly: [], monthly: [] });
    const [chartDataVersion, setChartDataVersion] = useState(0);

    const [contentsSelectedCategories, setContentsSelectedCategories] = useState(new Set());
    const seenContentsCategoriesRef = useRef(new Set());

    const [mobileSelectedCategories, setMobileSelectedCategories] = useState(new Set());
    const seenMobileCategoriesRef = useRef(new Set());

    const bumpChartDataVersion = useCallback(() => {
        setChartDataVersion(t => t + 1);
    }, []);

    const toggleContentsCategory = useCallback((cat) => {
        setContentsSelectedCategories(prev => {
            const next = new Set(prev);
            next.has(cat) ? next.delete(cat) : next.add(cat);
            return next;
        });
    }, []);

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

    // Fetch chart summary whenever data version bumps or login state changes
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

    // Auto-select newly arriving category names in contents filter
    useEffect(() => {
        const newlyArrived = categoryNames.filter(name => !seenContentsCategoriesRef.current.has(name));
        if (newlyArrived.length > 0) {
            setContentsSelectedCategories(prev => {
                const next = new Set(prev);
                newlyArrived.forEach(name => next.add(name));
                return next;
            });
            newlyArrived.forEach(name => seenContentsCategoriesRef.current.add(name));
        }
    }, [categoryNames]);

    // Auto-select newly arriving category names in mobile filter
    useEffect(() => {
        const newlyArrived = categoryNames.filter(name => !seenMobileCategoriesRef.current.has(name));
        if (newlyArrived.length > 0) {
            setMobileSelectedCategories(prev => {
                const next = new Set(prev);
                newlyArrived.forEach(name => next.add(name));
                return next;
            });
            newlyArrived.forEach(name => seenMobileCategoriesRef.current.add(name));
        }
    }, [categoryNames]);

    return (
        <ChartFilterContext.Provider value={{
            chartSummary,
            chartDataVersion, bumpChartDataVersion,
            contentsSelectedCategories,
            toggleContentsCategory,
            toggleAllContentsCategories,
            mobileSelectedCategories,
            toggleMobileCategory,
            toggleAllMobileCategories,
        }}>
            {children}
        </ChartFilterContext.Provider>
    );
}

export function useChartFilter() {
    return useContext(ChartFilterContext);
}
