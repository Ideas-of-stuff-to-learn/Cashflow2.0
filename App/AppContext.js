import { createContext, useContext, useState, useCallback } from 'react';

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
    // just landed in the DB" (see useChartData.js) needs something
    // finer-grained than processingStage - this ticks up once per
    // chunk, cache or LLM, regardless of which stage it happened in.
    const [categorizationTick, setCategorizationTick] = useState(0);
    const bumpCategorizationTick = useCallback(() => {
        setCategorizationTick(t => t + 1);
    }, []);

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
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    return useContext(AppContext);
}