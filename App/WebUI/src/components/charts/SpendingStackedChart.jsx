import { memo } from 'react';
import { transformValue } from '../../utils/charts/chartUtils';
import '../../styles/stackedChartStyles.css';

const BAR_WIDTH = 32;
const BAR_SPACING = 20;
const BASE_CHART_HEIGHT = 250;
const LEFT_PADDING = 10;
const LABEL_ROW_HEIGHT = 24;
const Y_AXIS_LABEL_WIDTH = 46;
const Y_AXIS_SECTIONS = 4;
const TOP_PADDING = 10;

const StackBar = memo(function StackBar({ bar, barIndex, maxValue, chartHeight, columnWidth, heightScale }) {
    let cumulativeBottom = 0;
    const visibleSegments = bar.stacks.filter(s => s.value > 0);
    const topSegmentIndex = visibleSegments.length > 0
        ? bar.stacks.indexOf(visibleSegments[visibleSegments.length - 1])
        : -1;

    return (
        <div
            style={{
                position: 'absolute',
                left: LEFT_PADDING + barIndex * columnWidth,
                bottom: 0,
                width: BAR_WIDTH,
                height: chartHeight,
            }}
        >
            {bar.stacks.map((segment, segIndex) => {
                const scaledValue = heightScale > 1
                    ? transformValue(segment.value, maxValue, heightScale)
                    : segment.value;
                const segHeight = (scaledValue / maxValue) * chartHeight;
                const bottom = cumulativeBottom;
                cumulativeBottom += segHeight;

                if (segHeight <= 0) return null;

                const isTop = segIndex === topSegmentIndex;

                return (
                    <button
                        key={segIndex}
                        onClick={segment.onPress}
                        className="stack-segment"
                        style={{
                            position: 'absolute',
                            left: 0,
                            bottom,
                            width: '100%',
                            height: segHeight,
                            backgroundColor: segment.color,
                            borderTopLeftRadius: isTop ? 4 : 0,
                            borderTopRightRadius: isTop ? 4 : 0,
                        }}
                    />
                );
            })}
        </div>
    );
});

function SpendingStackChart({ stackData, incomeData, heightScale = 1 }) {
    if (!stackData || stackData.length === 0) {
        return null;
    }

    const chartHeight = BASE_CHART_HEIGHT * heightScale;
    const columnWidth = BAR_WIDTH + BAR_SPACING;
    const totalWidth = LEFT_PADDING * 2 + stackData.length * columnWidth;

    const barTotals = stackData.map(bar =>
        bar.stacks.reduce((sum, segment) => sum + segment.value, 0)
    );
    const incomeValues = (incomeData || []).map(d => d.value || 0);
    const maxValue = Math.max(1, ...barTotals, ...incomeValues);

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
        <div className="stack-chart-scroll">
            <div style={{ display: 'flex' }}>
                {/* Fixed y-axis label column */}
                <div style={{ width: Y_AXIS_LABEL_WIDTH, height: TOP_PADDING + chartHeight, position: 'relative', flexShrink: 0 }}>
                    {yAxisLabels.map((label, i) => (
                        <span
                            key={i}
                            className="y-axis-label"
                            style={{ position: 'absolute', top: label.y - 7, width: Y_AXIS_LABEL_WIDTH - 6 }}
                        >
                            {`£${Math.round(label.value)}`}
                        </span>
                    ))}
                </div>

                <div className="stack-chart-hscroll">
                    <div style={{ width: totalWidth, height: TOP_PADDING + chartHeight + LABEL_ROW_HEIGHT, position: 'relative' }}>
                        {yAxisLabels.map((label, i) => (
                            <div
                                key={i}
                                className="grid-line"
                                style={{ top: label.y, width: totalWidth }}
                            />
                        ))}
                        <div className="x-axis-line" style={{ top: TOP_PADDING + chartHeight, width: totalWidth }} />

                        <div style={{ position: 'absolute', top: TOP_PADDING, left: 0, width: totalWidth, height: chartHeight }}>
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
                        </div>

                        {incomeData && incomeData.length > 1 && (
                            <svg
                                style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
                                width={totalWidth}
                                height={TOP_PADDING + chartHeight}
                            >
                                <polyline
                                    points={incomePoints}
                                    fill="none"
                                    stroke="#27AE60"
                                    strokeWidth={2}
                                />
                            </svg>
                        )}

                        <div style={{ position: 'absolute', top: TOP_PADDING + chartHeight + 2, left: 0, width: totalWidth, height: LABEL_ROW_HEIGHT }}>
                            {stackData.map((bar, i) => (
                                <span
                                    key={i}
                                    className="bar-label"
                                    style={{ position: 'absolute', left: LEFT_PADDING + i * columnWidth, width: BAR_WIDTH }}
                                >
                                    {bar.label}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default memo(SpendingStackChart);