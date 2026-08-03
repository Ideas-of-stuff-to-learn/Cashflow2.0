export default function BarLabelsRow({ stackData, totalWidth, rowTop, rowHeight, columnWidth, leftPadding, barWidth }) {
    return (
        <div style={{ position: 'absolute', top: rowTop, left: 0, width: totalWidth, height: rowHeight }}>
            {stackData.map((bar, i) => (
                <span key={i} className="bar-label" style={{ position: 'absolute', left: leftPadding + i * columnWidth, width: barWidth }}>
                    {bar.label}
                </span>
            ))}
        </div>
    );
}