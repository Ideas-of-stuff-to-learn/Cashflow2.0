import { createContext, useContext, useState } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
    const [transactions, setTransactions] = useState([]);
    const [categorising, setCategorising] = useState(false);
    const [parseError, setParseError] = useState(null);
    const [categories, setCategories] = useState([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [processingStage, setProcessingStage] = useState('idle');

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
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    return useContext(AppContext);
}