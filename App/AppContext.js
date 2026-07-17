import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getChartSummary } from './api.js';

const AppContext = createContext();

export function AppProvider({ children }) {
    const [transactions, setTransactions] = useState([]);
    const [categorising, setCategorising] = useState(false);
    const [parseError, setParseError] = useState(null);
    const [categories, setCategories] = useState([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [processingStage, setProcessingStage] = useState('idle');

    // processingStage only has a handful of values for an entire run
    // (idle -> parsing -> checkingCache -> waitingForLLM -> done) and
    // doesn't change per chunk - useFileProcessor.js can work through
    // many separate cache/LLM batches while stuck on the SAME stage
    // value the whole time. Anything that needs to know "the DB
    // changed in a way that affects chart totals" (see the
    // chartSummary effect below) needs something finer-grained than
    // processingStage - this ticks up once per categorisation chunk
    // (cache or LLM), AND on any other DB-changing action that should
    // refresh the charts (e.g. deleting transactions - see
    // ContentsScreen.js). Not tied to categorisation specifically
    // despite the name's history - anything that changes what charts
    // should show bumps this.
    const [chartDataVersion, setChartDataVersion] = useState(0);
    const bumpChartDataVersion = useCallback(() => {
        setChartDataVersion(t => t + 1);
    }, []);

    // Chart summary lives HERE, at the provider level, not inside
    // ChartsScreen/useChartData - deliberately. ChartsScreen is a stack
    // screen; navigation.goBack() fully UNMOUNTS it, and navigating
    // back to it mounts a fresh instance with fresh (empty) state. If
    // the summary lived there, every quick Home <-> Charts round trip
    // would: reset to empty, kick off a new fetch, and then likely get
    // unmounted again (cancelling that fetch, per the cleanup function)
    // before it ever resolves if the user navigates away again first -
    // which looks exactly like "Charts never updates", when what's
    // actually happening is every fetch keeps getting thrown away
    // before it lands. Keeping it here means it fetches in the
    // background continuously regardless of which screen is currently
    // mounted, and ChartsScreen just reads whatever's already there the
    // moment it mounts - no race, nothing to lose to a quick back-and-forth.
    const [chartSummary, setChartSummary] = useState({ yearly: [], monthly: [] });

    useEffect(() => {
        let cancelled = false;

        // A failed fetch here used to just warn and give up - fine
        // most of the time, since the NEXT tick would fetch again
        // anyway. But if the failure happens on the LAST tick of a
        // run (nothing left to trigger another attempt), the chart is
        // silently stuck one batch stale with no way to recover short
        // of another upload or an app restart. A short retry-with-
        // backoff covers exactly that case, for whatever transient
        // reason the fetch failed (seen once after a dev bundle
        // reload landed mid-flight and the very next SecureStore read
        // came back empty for a moment - but this guards against any
        // one-off blip, not just that specific cause).
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
    }, [chartDataVersion]);

    const categoryNames = categories.map(c => c.name);
    const categoryColors = Object.fromEntries(categories.map(c => [c.name, c.color]));
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
            processingStage,
            setProcessingStage,
            chartDataVersion,
            bumpChartDataVersion,
            chartSummary,
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    return useContext(AppContext);
}