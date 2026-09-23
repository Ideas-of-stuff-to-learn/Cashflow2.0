export default function YAxisLabelColumn({ yAxisLabels, width, height }) {
    return (
        <div style={{ width, height, position: 'relative', flexShrink: 0 }}>
            {yAxisLabels.map((label, i) => (
                <span key={i} className="y-axis-label" style={{ position: 'absolute', top: label.y - 7, width: width - 6 }}>
                    {`£${Math.round(label.value)}`}
                </span>
            ))}
        </div>
    );
}