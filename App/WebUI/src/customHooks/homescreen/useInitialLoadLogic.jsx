import { useMemo } from 'react';
import { getDateRangeInfo } from '../../utils/homescreen/homescreenUtils';
import { useTransactions } from '../../appState';

export function useInitialLoadLogic() {
    const { transactions, uploadCount, refetchUploadCount, retryInitialLoad } = useTransactions();

    const dateRangeInfo = useMemo(() => getDateRangeInfo(transactions), [transactions]);

    return {
        dateRangeInfo,
        uploadCount,
        refetchUploadCount,
        retryInitialLoad,
    };
}