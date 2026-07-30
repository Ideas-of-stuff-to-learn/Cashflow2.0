// customHooks/charts/useDataReadiness.js
//
// Single source of truth for "what should a chart show right now" -
// replaces the old showingDummyData/dummyTotals concept entirely. No
// fake numbers are generated anywhere; a chart is either showing real
// data, a loading placeholder, or a genuine "nothing here" message.
export function useDataReadiness(hasData, { initialLoading, categorising, processingStage } = {}) {
    const isLoading = !hasData && (
        initialLoading ||
        categorising ||
        processingStage === 'parsing' ||
        processingStage === 'checkingCache' ||
        processingStage === 'waitingForLLM'
    );

    const isEmpty = !hasData && !isLoading;

    return { isLoading, isEmpty };
}