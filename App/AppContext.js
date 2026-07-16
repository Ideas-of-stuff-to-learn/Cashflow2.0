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
    // value the whole time. Anything that needs to know "new real data
    // just landed in the DB" (see the chartSummary effect below) needs
    // something finer-grained than processingStage - this ticks up
    // once per chunk, cache or LLM, regardless of which stage it
    // happened in.
    const [categorizationTick, setCategorizationTick] = useState(0);
    const bumpCategorizationTick = useCallback(() => {
        setCategorizationTick(t => t + 1);
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
        getChartSummary()
            .then(data => {
                if (!cancelled) setChartSummary(data);
            })
            .catch(e => console.warn('Failed to load chart summary:', e.message));

        return () => { cancelled = true; };
    }, [categorizationTick]);

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
            categorizationTick,
            bumpCategorizationTick,
            chartSummary,
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    return useContext(AppContext);
}