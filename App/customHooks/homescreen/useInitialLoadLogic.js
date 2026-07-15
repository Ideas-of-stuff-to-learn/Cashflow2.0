import { getDateRangeInfo } from '../../utils/homescreen/homescreenUtils.js';
import {getTransactionHistory, getCategories } from '../../api.js';
import { useApp } from '../../AppContext.js';
import {useMemo, useEffect } from 'react';

export function useInitialLoadLogic(){
    const {
        transactions,
        setTransactions,
        setCategories,
        setInitialLoading,
    } = useApp();

   const dateRangeInfo = useMemo(() => getDateRangeInfo(transactions), [transactions]);

    useEffect(() => {
        let cancelled = false;
        async function loadInitialData() {
            try {
                // Fetch in parallel - unrelated data, no reason to wait
                // on one before starting the other
                const [history, cats] = await Promise.all([
                    getTransactionHistory(),
                    getCategories(),
                ]);
                if (!cancelled) {
                    setTransactions(history);
                    setCategories(cats);
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
        dateRangeInfo
    }
}