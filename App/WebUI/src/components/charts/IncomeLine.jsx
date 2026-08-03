export default function IncomeLine({ incomeData, incomePoints, totalWidth, svgHeight }) {
    if (!incomeData || incomeData.length <= 1) return null;

    return (
        <svg style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} width={totalWidth} height={svgHeight}>
            <polyline points={incomePoints} fill="none" stroke="#27AE60" strokeWidth={2} />
        </svg>
    );
}