import { Text } from 'react-native';
import { styles } from '../../styles/chartStyes';
import SpendingBarChart from './SpendingBarChart';

export default function SpendingOverview({ hasData, filteredChartData2, categorising, initialLoading, selectedBar }) {
    return (
        <>
            {hasData ? (
                <SpendingBarChart data={filteredChartData2} />
            ) : (
                <Text style={styles.emptyText}>
                    {categorising || initialLoading
                        ? 'Waiting for categorisation to finish…'
                        : 'No categorised transactions yet — upload a CSV to see charts.'}
                </Text>
            )}
            {selectedBar && (
                <Text style={styles.tappedValueText}>
                    {selectedBar.category}: £{selectedBar.total.toFixed(2)}
                </Text>
            )}
        </>
    );
}