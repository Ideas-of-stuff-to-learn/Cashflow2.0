import '../../styles/chartStyles.css';
import SpendingBarChart from './SpendingBarChart';
import LoadingBarsPlaceholder from '../loading/LoadingBarsPlaceholder';
import { useDataReadiness } from '../../customHooks/charts/useDataReadiness';

export default function SpendingOverview({ hasData, filteredChartData2, categorising, initialLoading, selectedBar }) {
    const { isLoading } = useDataReadiness(hasData, { categorising, initialLoading });

    return (
        <>
            {hasData ? (
                <SpendingBarChart data={filteredChartData2} />
            ) : isLoading ? (
                <LoadingBarsPlaceholder />
            ) : (
                <p className="empty-text">No categorised transactions yet — upload a CSV to see charts.</p>
            )}
            {selectedBar && (
                <p className="tapped-value-text">
                    {selectedBar.category}: £{selectedBar.total.toFixed(2)}
                </p>
            )}
        </>
    );
}