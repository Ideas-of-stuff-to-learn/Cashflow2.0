import { Text, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { useState } from 'react';
import { styles } from '../../styles/chartStyes.js';
import SpendingStackChart from './SpendingStackedChart.js';
import { monthLabel } from '../../utils/charts/yearlyChartUtils.js';

export default function DetailedChartSection({
    selectedYear,
    monthChartData,
    monthIncomeLineData,
    selectedSegment,
    closeDrilldown,
}) {
    const [heightScale, setHeightScale] = useState(1);

    if (selectedYear == null) return null;

    return (
        <>
            <Text style={styles.sectionLabel}>{selectedYear} by month</Text>
            <TouchableOpacity onPress={closeDrilldown}>
                <Text style={styles.chipText}>Close ✕</Text>
            </TouchableOpacity>

            <Text style={styles.sectionLabel}>Zoom: {heightScale.toFixed(1)}x</Text>
            <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={1}
                maximumValue={15}
                value={1}
                step={1}
                onValueChange={(val) => setHeightScale(val)}
                minimumTrackTintColor="#2E5C8A"
                maximumTrackTintColor="#ccc"
            />

            <SpendingStackChart
                stackData={monthChartData}
                incomeData={monthIncomeLineData}
                heightScale={heightScale}
            />

            {selectedSegment && (
                <Text style={styles.tappedValueText}>
                    {monthLabel(selectedSegment.month)} {selectedSegment.year} — {selectedSegment.category}: £{selectedSegment.value.toFixed(2)}
                </Text>
            )}
        </>
    );
}