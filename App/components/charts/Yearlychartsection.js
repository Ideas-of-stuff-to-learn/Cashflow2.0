import { Text } from 'react-native';
import { styles } from '../../styles/chartStyes.js';
import SpendingStackChart from './SpendingStackedChart.js';

// `ready` comes from useDetailedChartReveal() - it's not a "tap to expand"
// toggle, it's InteractionManager.runAfterInteractions() deferring this
// render until the screen's navigation transition has finished, so a
// heavy stacked chart mounting doesn't stutter the transition animation.
// This is the chart that renders immediately on screen entry, so it's
// the one that actually needs that deferral - the month drill-down below
// only ever mounts later, well after any transition has settled, so it
// doesn't need this treatment.
export default function YearlyChartSection({
    ready,
    hasData,
    showingDummyData,
    yearChartData,
    yearIncomeLineData,
    selectedYear,
    selectedYearSegment,
    selectedYearTotal,
}) {
    if (!ready) return null;

    if (!hasData) {
        return (
            <Text style={styles.emptyText}>
                No categorised transactions yet — upload a CSV to see charts.
            </Text>
        );
    }

    return (
        <>
            {showingDummyData && (
                <Text style={styles.emptyText}>
                    Showing example data while we categorise your transactions…
                </Text>
            )}
            <Text style={styles.sectionLabel}>Spending by year — tap a segment to see months</Text>
            <SpendingStackChart
                stackData={yearChartData}
                incomeData={yearIncomeLineData}
                heightScale={1}
            />
            {selectedYearSegment && (
                <Text style={styles.tappedValueText}>
                    {selectedYearSegment.year} — {selectedYearSegment.category}: £{selectedYearSegment.value.toFixed(2)}
                </Text>
            )}
            {selectedYear != null && (
                <Text style={styles.tappedValueText}>
                    {selectedYear} total: £{selectedYearTotal.toFixed(2)}
                </Text>
            )}
        </>
    );
}