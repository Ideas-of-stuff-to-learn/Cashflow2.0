import { memo } from 'react';
import { transformValue } from '../../utils/charts/chartUtils';
import { useSegmentPopup } from '../../customHooks/charts/useSegmentPopup';
import { useModalSegmentPopup } from '../../customHooks/charts/useModalSegmentPopup';
import SegmentPopupFixed from './SegmentPopupFixed';
import SegmentPopupFloating from './SegmentPopupFloating';
import SegmentPopupModal from './SegmentPopupModal';
import '../../styles/stackedChartStyles.css';

// ---------------------------------------------------------------
// SINGLE SWAP POINT - change this one value to switch which popup
// variant is active everywhere. Nothing else in this file needs to
// change when swapping.
// Options: 'fixed' | 'floating' | 'modal'
const POPUP_VARIANT = 'fixed';
// ---------------------------------------------------------------

const BAR_WIDTH = 32;
const BAR_SPACING = 20;
const BASE_CHART_HEIGHT = 250;
const LEFT_PADDING = 10;
const LABEL_ROW_HEIGHT = 24;
const Y_AXIS_LABEL_WIDTH = 46;
const Y_AXIS_SECTIONS = 4;
const TOP_PADDING = 10;
const LABEL_HEADROOM = 24;

const StackBar = memo(function StackBar({ bar, barIndex, maxValue, chartHeight, columnWidth, heightScale, onSegmentInteract, barsInert, floatingPositionRef }) {
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
                // A unique, stable key identifying THIS exact segment -
                // used two ways: (1) as the key in floatingPositionRef,
                // storing where this segment actually sits on screen,
                // and (2) carried along on the segment data sent to the
                // popup hooks, so the floating variant can later look up
                // EXACTLY this segment's position rather than an
                // arbitrary one.
                const positionKey = `${barIndex}-${segIndex}`;

                function handleRef(el) {
                    if (el && floatingPositionRef) {
                        floatingPositionRef.current[positionKey] = {
                            left: LEFT_PADDING + barIndex * columnWidth + BAR_WIDTH / 2,
                            top: bottom,
                        };
                    }
                }

                function fire() {
                    if (barsInert) return; // Variant 1: other bars inert while its popup is open
                    segment.onPress(); // existing action (year jump / below-chart text setter) still fires
                    onSegmentInteract(segment, positionKey);
                }

                return (
                    <button
                        key={segIndex}
                        ref={handleRef}
                        onClick={fire}
                        onMouseEnter={fire}
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

    const fixedFloating = useSegmentPopup();
    const modal = useModalSegmentPopup();

    const isModal = POPUP_VARIANT === 'modal';
    const activeSegment = isModal ? modal.activeSegment : fixedFloating.activeSegment;
    const barsInert = isModal ? modal.otherBarsInert : false;

    const floatingPositionRef = { current: {} };

    // FIX: bundles the segment's own positionKey INTO the object sent
    // to the popup hooks (as _positionKey), rather than the previous
    // version which only passed `key` as a separate, unused argument.
    // This is what lets the floating variant later look up EXACTLY
    // this segment's real screen position - the old code had no way
    // to know which key belonged to the currently-active segment, and
    // was grabbing an arbitrary one instead.
    function handleSegmentInteract(segmentData, key) {
        const withKey = { ...segmentData, _positionKey: key };
        if (isModal) {
            modal.showSegment(withKey);
        } else {
            fixedFloating.showSegment(withKey);
        }
    }

    function handleChartMouseLeave() {
        if (!isModal) fixedFloating.handleChartMouseLeave();
    }

    function handleChartBackgroundClick() {
        if (!isModal) fixedFloating.handleChartBackgroundClick();
    }

    const chartHeight = BASE_CHART_HEIGHT * heightScale;
    const columnWidth = BAR_WIDTH + BAR_SPACING;
    const totalWidth = LEFT_PADDING * 2 + stackData.length * columnWidth;
    const barTotals = stackData.map(bar => bar.total ?? bar.stacks.reduce((sum, s) => sum + s.value, 0));

    const incomeValues = (incomeData || []).map(d => d.value || 0);
    const maxValue = Math.max(1, ...barTotals, ...incomeValues);

    const yAxisLabels = Array.from({ length: Y_AXIS_SECTIONS + 1 }, (_, i) => {
        const value = (maxValue / Y_AXIS_SECTIONS) * i;
        return { value, y: LABEL_HEADROOM + TOP_PADDING + chartHeight - (value / maxValue) * chartHeight };
    });

    const incomePoints = (incomeData || [])
        .map((d, i) => {
            const x = LEFT_PADDING + i * columnWidth + BAR_WIDTH / 2;
            const y = LABEL_HEADROOM + TOP_PADDING + chartHeight - ((d.value || 0) / maxValue) * chartHeight;
            return `${x},${y}`;
        })
        .join(' ');

    return (
        <>
            {incomeData && incomeData.length > 1 && (
                <div className="income-legend">
                    <span className="income-legend-line" />
                    <span className="income-legend-text">Income</span>
                </div>
            )}

            {POPUP_VARIANT === 'fixed' && <SegmentPopupFixed segment={activeSegment} />}

            <div
                className="stack-chart-scroll"
                onMouseLeave={handleChartMouseLeave}
                onClick={(e) => {
                    if (e.target === e.currentTarget) handleChartBackgroundClick();
                }}
                style={{ position: 'relative' }}
            >
                <div style={{ display: 'flex' }}>
                    <div style={{ width: Y_AXIS_LABEL_WIDTH, height: LABEL_HEADROOM + TOP_PADDING + chartHeight, position: 'relative', flexShrink: 0 }}>
                        {yAxisLabels.map((label, i) => (
                            <span key={i} className="y-axis-label" style={{ position: 'absolute', top: label.y - 7, width: Y_AXIS_LABEL_WIDTH - 6 }}>
                                {`£${Math.round(label.value)}`}
                            </span>
                        ))}
                    </div>

                    <div className="stack-chart-hscroll" onClick={(e) => { if (e.target === e.currentTarget) handleChartBackgroundClick(); }}>
                        <div style={{ width: totalWidth, height: LABEL_HEADROOM + TOP_PADDING + chartHeight + LABEL_ROW_HEIGHT, position: 'relative' }}>
                            {yAxisLabels.map((label, i) => (
                                <div key={i} className="grid-line" style={{ top: label.y, width: totalWidth }} />
                            ))}
                            <div className="x-axis-line" style={{ top: LABEL_HEADROOM + TOP_PADDING + chartHeight, width: totalWidth }} />

                            <div style={{ position: 'absolute', top: LABEL_HEADROOM + TOP_PADDING, left: 0, width: totalWidth, height: chartHeight }}>
                                {stackData.map((bar, barIndex) => (
                                    <StackBar
                                        key={barIndex}
                                        bar={bar}
                                        barIndex={barIndex}
                                        maxValue={maxValue}
                                        chartHeight={chartHeight}
                                        columnWidth={columnWidth}
                                        heightScale={heightScale}
                                        onSegmentInteract={handleSegmentInteract}
                                        barsInert={barsInert}
                                        floatingPositionRef={POPUP_VARIANT === 'floating' ? floatingPositionRef : null}
                                    />
                                ))}
                            </div>

                            {incomeData && incomeData.length > 1 && (
                                <svg style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} width={totalWidth} height={LABEL_HEADROOM + TOP_PADDING + chartHeight}>
                                    <polyline points={incomePoints} fill="none" stroke="#27AE60" strokeWidth={2} />
                                </svg>
                            )}

                            <div style={{ position: 'absolute', top: 0, left: 0, width: totalWidth, height: LABEL_HEADROOM + TOP_PADDING + chartHeight, pointerEvents: 'none' }}>
                                {stackData.map((bar, i) => {
                                    const visibleSum = bar.stacks.reduce((sum, segment) => {
                                        const scaledValue = heightScale > 1 ? transformValue(segment.value, maxValue, heightScale) : segment.value;
                                        return sum + (scaledValue / maxValue) * chartHeight;
                                    }, 0);
                                    const barTopY = LABEL_HEADROOM + TOP_PADDING + chartHeight - visibleSum;
                                    return (
                                        <span key={i} className="bar-total-label" style={{ position: 'absolute', left: LEFT_PADDING + i * columnWidth, top: barTopY - 18, width: BAR_WIDTH }}>
                                            £{Math.round(bar.total ?? 0).toLocaleString()}
                                        </span>
                                    );
                                })}
                            </div>

                            {/* FIX: looks up the position using activeSegment._positionKey
                                specifically - the exact key of whichever segment is
                                actually showing - instead of the old placeholder that
                                grabbed an arbitrary key from the ref object. */}
                            {POPUP_VARIANT === 'floating' && activeSegment && (
                                <SegmentPopupFloating
                                    segment={activeSegment}
                                    position={floatingPositionRef.current[activeSegment._positionKey] || null}
                                />
                            )}

                            <div style={{ position: 'absolute', top: LABEL_HEADROOM + TOP_PADDING + chartHeight + 2, left: 0, width: totalWidth, height: LABEL_ROW_HEIGHT }}>
                                {stackData.map((bar, i) => (
                                    <span key={i} className="bar-label" style={{ position: 'absolute', left: LEFT_PADDING + i * columnWidth, width: BAR_WIDTH }}>
                                        {bar.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {POPUP_VARIANT === 'modal' && (
                    <SegmentPopupModal segment={activeSegment} onMouseLeave={modal.handlePopupMouseLeave} />
                )}
            </div>
        </>
    );
}

export default memo(SpendingStackChart);