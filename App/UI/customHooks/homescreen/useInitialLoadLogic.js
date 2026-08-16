import { useMemo } from 'react';
import { getDateRangeInfo } from '../../../shared/utils/homescreenUtils.js';
import { useApp } from '../../AppContext.js';

export function useInitialLoadLogic() {
    const { transactions, uploadCount, refetchUploadCount } = useApp();
    const dateRangeInfo = useMemo(() => getDateRangeInfo(transactions), [transactions]);
    return { dateRangeInfo, uploadCount, refetchUploadCount };
}
