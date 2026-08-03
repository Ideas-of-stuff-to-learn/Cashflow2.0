import { memo } from 'react';
import { transformValue } from '../../utils/charts/chartUtils';
import { computeSegmentAnchor } from '../../utils/charts/stackChartGeometry';

const BAR_WIDTH = 32;
const LEFT_PADDING = 10;

const StackBar = memo(function StackBar({
    bar, barIndex, maxValue, chartHeight, columnWidth, heightScale,
    onSegmentInteract, labelHeadroom, topPadding, popupVariant,
}) {
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
                const positionKey = `${barIndex}-${segIndex}`;

                function fire() {
                    segment.onPress();
                    const anchor = computeSegmentAnchor({
                        barIndex, columnWidth, leftPadding: LEFT_PADDING, barWidth: BAR_WIDTH,
                        bottom, segHeight, labelHeadroom, topPadding, chartHeight,
                    });
                    onSegmentInteract({
                        year: segment.year,
                        month: segment.month,
                        category: segment.category,
                        value: segment.realValue,
                    }, positionKey, anchor);
                }

                function handleClick(e) {
                    e.stopPropagation();
                    fire();
                }

                // Fixed variant ONLY responds to click - hover does
                // nothing at all (no open, no update). Floating/modal
                // keep the original "hover or click both work" feel.
                function handleMouseEnter(e) {
                    if (popupVariant === 'fixed') return;
                    e.stopPropagation();
                    fire();
                }

                return (
                    <button
                        key={segIndex}
                        onClick={handleClick}
                        onMouseEnter={handleMouseEnter}
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

export default StackBar;