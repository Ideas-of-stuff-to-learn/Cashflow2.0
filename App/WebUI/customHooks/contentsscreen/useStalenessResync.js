import { useEffect, useRef } from 'react';
import { getCategories, getTransactionHistory } from '../../api.js';
import { isStale } from '../../utils/contentsscreen/contentsUtils.js';

// Proactively catches the case where a category was renamed/combined/
// deleted (by an admin, elsewhere) while this device is still holding
// transactions that reference the old name. Runs a single resync fetch
// the moment any transaction looks stale, rather than waiting for the
// user to notice a category that no longer exists anywhere.
export function useStalenessResync({ transactions, categoryNames, initialLoading, setCategories, setTransactions }) {
    const resyncInFlight = useRef(false);

    useEffect(() => {
        if (initialLoading) return;
        if (categoryNames.length === 0) return;
        if (resyncInFlight.current) return;

        const anyStale = transactions.some(t => isStale(t, categoryNames));
        if (!anyStale) return;

        let cancelled = false;
        resyncInFlight.current = true;

        async function resync() {
            try {
                const [freshCategories, freshTransactions] = await Promise.all([
                    getCategories(),
                    getTransactionHistory(),
                ]);
                if (!cancelled) {
                    setCategories(freshCategories);
                    setTransactions(freshTransactions);
                }
            } catch (e) {
                console.warn('Proactive staleness resync failed:', e.message);
            } finally {
                resyncInFlight.current = false;
            }
        }
        resync();

        return () => { cancelled = true; };
    }, [transactions, categoryNames, initialLoading]);
}
