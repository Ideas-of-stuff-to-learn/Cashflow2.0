export default function ChartGridLines({ yAxisLabels, totalWidth, xAxisY }) {
    return (
        <>
            {yAxisLabels.map((label, i) => (
                <div key={i} className="grid-line" style={{ top: label.y, width: totalWidth, pointerEvents: 'none' }} />
            ))}
            <div className="x-axis-line" style={{ top: xAxisY, width: totalWidth, pointerEvents: 'none' }} />
        </>
    );
}