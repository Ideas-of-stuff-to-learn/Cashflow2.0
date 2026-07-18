import React from 'react';
import { transformValue } from '../../utils/charts/chartUtils.js';
import { View, ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { styles } from '../../styles/stackedChartStyles';
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
// Reserved space ABOVE the plotting area, purely so the topmost y-axis
// label (whose gridline sits at y=0, the very top of the chart) has
// room to vertically center itself without being pushed above the
// container's own top edge and getting cut off. Bars are anchored to
// the bottom, so adding height only at the top doesn't disturb them -
// everything else (gridlines, axis lines, bar labels) just needs to
// shift down by this same amount to stay aligned with the bars.
const TOP_PADDING = 10;

// Memoised per-bar component. Previously all bars were rendered inline
// inside SpendingStackChart's render function - when maxValue changed
// (any data change) every bar re-rendered even if its own segments were
// identical. Now each bar only re-renders when its own props change.
// Props are all primitives or the bar object itself - memo's shallow
// comparison skips a bar correctly when nothing about it changed.
const StackBar = React.memo(function StackBar({ bar, barIndex, maxValue, chartHeight, columnWidth, heightScale }) {
    let cumulativeBottom = 0;
    const visibleSegments = bar.stacks.filter(s => s.value > 0);
    const topSegmentIndex = visibleSegments.length > 0
        ? bar.stacks.indexOf(visibleSegments[visibleSegments.length - 1])
        : -1;

    return (
        <View
            style={{
                position: 'absolute',
                left: LEFT_PADDING + barIndex * columnWidth,
                bottom: 0,
                width: BAR_WIDTH,
                height: chartHeight,
            }}
        >
            {bar.stacks.map((segment, segIndex) => {
                // transformValue stretches small segments relative to large
                // ones when heightScale > 1, so they become easier to tap.
                // The displayed value in onPress is always the TRUE amount
                // (segment.onPress uses the real value from yearlyChartUtils,
                // not the inflated render height) - only the visual height
                // changes, never what gets reported.
                const scaledValue = heightScale > 1
                    ? transformValue(segment.value, maxValue, heightScale)
                    : segment.value;
                const segHeight = (scaledValue / maxValue) * chartHeight;
                const bottom = cumulativeBottom;
                cumulativeBottom += segHeight;

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
});

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
    // Shifted down by TOP_PADDING so the top one (y=TOP_PADDING here,
    // was y=0 before) has headroom to render its label fully.
    const yAxisLabels = Array.from({ length: Y_AXIS_SECTIONS + 1 }, (_, i) => {
        const value = (maxValue / Y_AXIS_SECTIONS) * i;
        return { value, y: TOP_PADDING + chartHeight - (value / maxValue) * chartHeight };
    });

    const incomePoints = (incomeData || [])
        .map((d, i) => {
            const x = LEFT_PADDING + i * columnWidth + BAR_WIDTH / 2;
            const y = TOP_PADDING + chartHeight - ((d.value || 0) / maxValue) * chartHeight;
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
                <View style={{ width: Y_AXIS_LABEL_WIDTH, height: TOP_PADDING + chartHeight }}>
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
                    <View style={{ width: totalWidth, height: TOP_PADDING + chartHeight + LABEL_ROW_HEIGHT }}>
                        {/* Horizontal gridlines, one per y-axis label */}
                        {yAxisLabels.map((label, i) => (
                            <View
                                key={i}
                                style={[styles.gridLine, { top: label.y, width: totalWidth }]}
                            />
                        ))}
                        {/* X axis line - sits at the bottom of the plot area,
                            i.e. TOP_PADDING + chartHeight down from the top,
                            not at the old unpadded chartHeight position */}
                        <View style={[styles.xAxisLine, { top: TOP_PADDING + chartHeight, width: totalWidth }]} />

                        <View style={{ position: 'absolute', top: TOP_PADDING, left: 0, width: totalWidth, height: chartHeight }}>
                            {stackData.map((bar, barIndex) => (
                                <StackBar
                                    key={barIndex}
                                    bar={bar}
                                    barIndex={barIndex}
                                    maxValue={maxValue}
                                    chartHeight={chartHeight}
                                    columnWidth={columnWidth}
                                    heightScale={heightScale}
                                />
                            ))}
                        </View>

                        {incomeData && incomeData.length > 1 && (
                            <Svg
                                style={{ position: 'absolute', top: 0, left: 0 }}
                                width={totalWidth}
                                height={TOP_PADDING + chartHeight}
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

                        <View style={{ position: 'absolute', top: TOP_PADDING + chartHeight + 2, left: 0, width: totalWidth, height: LABEL_ROW_HEIGHT }}>
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



export default React.memo(SpendingStackChart);