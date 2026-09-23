import { computeBarTotalLabelPosition } from '../../utils/charts/stackChartGeometry';

export default function BarTotalsLayer({ stackData, totalWidth, layerHeight, columnWidth, leftPadding, barWidth, maxValue, chartHeight, heightScale, labelHeadroom, topPadding }) {
    return (
        <div style={{ position: 'absolute', top: 0, left: 0, width: totalWidth, height: layerHeight, pointerEvents: 'none' }}>
            {stackData.map((bar, i) => {
                const barTopY = computeBarTotalLabelPosition(bar, { maxValue, chartHeight, heightScale, labelHeadroom, topPadding });
                return (
                    <span key={i} className="bar-total-label" style={{ position: 'absolute', left: leftPadding + i * columnWidth, top: barTopY - 18, width: barWidth }}>
                        £{Math.round(bar.total ?? 0).toLocaleString()}
                    </span>
                );
            })}
        </div>
    );
}