import React from 'react';
import { View, ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

// Replaces react-native-gifted-charts' BarChart(stackData=...) for this
// one job. After extensive digging through the library's compiled
// internals (see conversation history), its per-segment onPress
// handling turned out to be genuinely unreliable in ways that couldn't
// be fixed from our side - sometimes silently not firing, sometimes
// firing with stale data, both traced to the library's own absolute-
// positioning math for stacked segments, not anything in our data.
//
// This renders each segment as a REAL Pressable, explicitly positioned
// by us via simple bottom-up cumulative height math - there's no
// touch-detection guessing involved, because each segment IS its own
// pressable element, not an inferred hit region layered on top of a
// separately-rendered visual.
//
// Deliberately kept the exact same prop interface as before
// (stackData, incomeData, heightScale) so nothing upstream
// (useChartData, yearlyChartUtils, YearlyChartSection,
// DetailedChartSection) needed to change at all.

const BAR_WIDTH = 32;
const BAR_SPACING = 20;
const BASE_CHART_HEIGHT = 250;
const LEFT_PADDING = 10;
const LABEL_ROW_HEIGHT = 24;
const Y_AXIS_LABEL_WIDTH = 46;
const Y_AXIS_SECTIONS = 4;

function SpendingStackChart({ stackData, incomeData, heightScale = 1 }) {
    if (!stackData || stackData.length === 0) {
        return null;
    }

    const chartHeight = BASE_CHART_HEIGHT * heightScale;
    const columnWidth = BAR_WIDTH + BAR_SPACING;
    const totalWidth = LEFT_PADDING * 2 + stackData.length * columnWidth;

    // Same idea as any bar chart's Y-axis scaling - every bar (and the
    // income line) is scaled relative to the single largest total across
    // the whole dataset, so bars are comparable to each other rather than
    // each independently filling the full chart height.
    const barTotals = stackData.map(bar =>
        bar.stacks.reduce((sum, segment) => sum + segment.value, 0)
    );
    const incomeValues = (incomeData || []).map(d => d.value || 0);
    const maxValue = Math.max(1, ...barTotals, ...incomeValues);

    // Five gridlines (0%, 25%, 50%, 75%, 100% of maxValue), each with its
    // own y-position - shared by both the fixed label column and the
    // gridlines drawn inside the scrollable bars area, so they always
    // line up with each other regardless of horizontal scroll position.
    const yAxisLabels = Array.from({ length: Y_AXIS_SECTIONS + 1 }, (_, i) => {
        const value = (maxValue / Y_AXIS_SECTIONS) * i;
        return { value, y: chartHeight - (value / maxValue) * chartHeight };
    });

    const incomePoints = (incomeData || [])
        .map((d, i) => {
            const x = LEFT_PADDING + i * columnWidth + BAR_WIDTH / 2;
            const y = chartHeight - ((d.value || 0) / maxValue) * chartHeight;
            return `${x},${y}`;
        })
        .join(' ');

    return (
        // Vertical scroll wraps BOTH the fixed y-axis column and the
        // horizontally-scrolling bars together, so zooming (heightScale)
        // moves them as one unit and they stay aligned with each other.
        <ScrollView style={{ height: 300 }} nestedScrollEnabled scrollEnabled>
            <View style={{ flexDirection: 'row' }}>
                {/* Fixed y-axis label column - does NOT scroll horizontally */}
                <View style={{ width: Y_AXIS_LABEL_WIDTH, height: chartHeight }}>
                    {yAxisLabels.map((label, i) => (
                        <Text
                            key={i}
                            numberOfLines={1}
                            style={[
                                styles.yAxisLabel,
                                { position: 'absolute', top: label.y - 7, width: Y_AXIS_LABEL_WIDTH - 6 },
                            ]}
                        >
                            {`£${Math.round(label.value)}`}
                        </Text>
                    ))}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ width: totalWidth, height: chartHeight + LABEL_ROW_HEIGHT }}>
                        {/* Horizontal gridlines, one per y-axis label */}
                        {yAxisLabels.map((label, i) => (
                            <View
                                key={i}
                                style={[styles.gridLine, { top: label.y, width: totalWidth }]}
                            />
                        ))}
                        {/* X axis line */}
                        <View style={[styles.xAxisLine, { top: chartHeight, width: totalWidth }]} />

                        <View style={{ position: 'absolute', top: 0, left: 0, width: totalWidth, height: chartHeight }}>
                            {stackData.map((bar, barIndex) => {
                                let cumulativeBottom = 0;
                                const visibleSegments = bar.stacks.filter(s => s.value > 0);
                                const topSegmentIndex = visibleSegments.length > 0
                                    ? bar.stacks.indexOf(visibleSegments[visibleSegments.length - 1])
                                    : -1;

                                return (
                                    <View
                                        key={barIndex}
                                        style={{
                                            position: 'absolute',
                                            left: LEFT_PADDING + barIndex * columnWidth,
                                            bottom: 0,
                                            width: BAR_WIDTH,
                                            height: chartHeight,
                                        }}
                                    >
                                        {bar.stacks.map((segment, segIndex) => {
                                            const segHeight = (segment.value / maxValue) * chartHeight;
                                            const bottom = cumulativeBottom;
                                            cumulativeBottom += segHeight;

                                            // Genuine zeros (segment.value === 0) never reach here
                                            // as anything but 0 - yearlyChartUtils.js only applies
                                            // the minimum-height floor to NONZERO values, so a real
                                            // zero stays exactly 0 and is filtered out here, never
                                            // rendered as a padded sliver.
                                            if (segHeight <= 0) return null;

                                            const isTop = segIndex === topSegmentIndex;

                                            return (
                                                <Pressable
                                                    key={segIndex}
                                                    onPress={segment.onPress}
                                                    style={({ pressed }) => ({
                                                        position: 'absolute',
                                                        left: 0,
                                                        bottom,
                                                        width: '100%',
                                                        height: segHeight,
                                                        backgroundColor: segment.color,
                                                        opacity: pressed ? 0.6 : 1,
                                                        borderTopLeftRadius: isTop ? 4 : 0,
                                                        borderTopRightRadius: isTop ? 4 : 0,
                                                    })}
                                                />
                                            );
                                        })}
                                    </View>
                                );
                            })}
                        </View>

                        {incomeData && incomeData.length > 1 && (
                            <Svg
                                style={StyleSheet.absoluteFillObject}
                                width={totalWidth}
                                height={chartHeight}
                                pointerEvents="none"
                            >
                                <Polyline
                                    points={incomePoints}
                                    fill="none"
                                    stroke="#27AE60"
                                    strokeWidth={2}
                                />
                            </Svg>
                        )}

                        <View style={{ position: 'absolute', top: chartHeight + 2, left: 0, width: totalWidth, height: LABEL_ROW_HEIGHT }}>
                            {stackData.map((bar, i) => (
                                <Text
                                    key={i}
                                    numberOfLines={1}
                                    style={[
                                        styles.barLabel,
                                        { position: 'absolute', left: LEFT_PADDING + i * columnWidth, width: BAR_WIDTH },
                                    ]}
                                >
                                    {bar.label}
                                </Text>
                            ))}
                        </View>
                    </View>
                </ScrollView>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    xAxisLine: { position: 'absolute', left: 0, height: 1, backgroundColor: '#ccc' },
    gridLine: { position: 'absolute', left: 0, height: 1, backgroundColor: '#eee' },
    yAxisLabel: { fontSize: 10, color: '#777', textAlign: 'right' },
    barLabel: { fontSize: 11, color: '#555', textAlign: 'center' },
});

export default React.memo(SpendingStackChart);