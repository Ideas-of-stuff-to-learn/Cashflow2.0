import { useMemo } from 'react';
import { getDateRangeInfo } from '../../utils/homescreen/homescreenUtils';
import { useApp } from '../../AppContext';

export function useInitialLoadLogic() {
    const { transactions, uploadCount, refetchUploadCount, retryInitialLoad } = useApp();

    const dateRangeInfo = useMemo(() => getDateRangeInfo(transactions), [transactions]);

    return {
        dateRangeInfo,
        uploadCount,
        refetchUploadCount,
        retryInitialLoad,
    };
}