import { Text, View } from 'react-native';
import { useState } from 'react';
import Slider from '@react-native-community/slider';
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

    const [heightScale, setHeightScale] = useState(1);

    return (
        <>
            {showingDummyData && (
                <Text style={styles.emptyText}>
                    Showing example data while we categorise your transactions…
                </Text>
            )}
            <Text style={styles.sectionLabel}>Spending by year — tap a segment to see months</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Text style={[styles.sectionLabel, { marginBottom: 0, marginRight: 8 }]}>
                    Segment scale: {heightScale.toFixed(1)}x
                </Text>
                <Slider
                    style={{ flex: 1, height: 32 }}
                    minimumValue={1}
                    maximumValue={15}
                    value={1}
                    step={1}
                    onValueChange={setHeightScale}
                    minimumTrackTintColor="#2E5C8A"
                    maximumTrackTintColor="#ccc"
                />
            </View>
            <SpendingStackChart
                stackData={yearChartData}
                incomeData={yearIncomeLineData}
                heightScale={heightScale}
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