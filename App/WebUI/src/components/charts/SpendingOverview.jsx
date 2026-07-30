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
            ) : (
                <LoadingBarsPlaceholder
                    message={isLoading ? 'Preparing your data...' : 'No categorised transactions yet — upload a CSV to see charts.'}
                />
            )}
            {selectedBar && (
                <p className="tapped-value-text">
                    {selectedBar.category}: £{selectedBar.total.toFixed(2)}
                </p>
            )}
        </>
    );
}