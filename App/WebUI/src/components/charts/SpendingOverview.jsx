import '../../styles/chartStyles.css';
import SpendingBarChart from './SpendingBarChart';

export default function SpendingOverview({ hasData, filteredChartData2, categorising, initialLoading, selectedBar }) {
    return (
        <>
            {hasData ? (
                <SpendingBarChart data={filteredChartData2} />
            ) : (
                <p className="empty-text">
                    {categorising || initialLoading
                        ? 'Waiting for categorisation to finish…'
                        : 'No categorised transactions yet — upload a CSV to see charts.'}
                </p>
            )}
            {selectedBar && (
                <p className="tapped-value-text">
                    {selectedBar.category}: £{selectedBar.total.toFixed(2)}
                </p>
            )}
        </>
    );
}