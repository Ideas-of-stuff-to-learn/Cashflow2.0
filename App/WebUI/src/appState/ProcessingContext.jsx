import { createContext, useContext, useState, useCallback } from 'react';
import { NEEDS_MANUAL_REVIEW } from '../checkingName';

const ProcessingContext = createContext();

export function ProcessingProvider({ children }) {
    const [categorising, setCategorising] = useState(false);
    const [processingStage, setProcessingStage] = useState('idle');
    const [parseError, setParseError] = useState(null);
    const [manualReviewFlow, setManualReviewFlow] = useState(null);

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

    return (
        <ProcessingContext.Provider value={{
            categorising, setCategorising,
            processingStage, setProcessingStage,
            parseError, setParseError,
            manualReviewFlow, setManualReviewFlow,
            startManualReviewFlowIfNeeded,
            enterSequentialReview,
            closeManualReviewFlow,
        }}>
            {children}
        </ProcessingContext.Provider>
    );
}

export function useProcessing() {
    return useContext(ProcessingContext);
}
