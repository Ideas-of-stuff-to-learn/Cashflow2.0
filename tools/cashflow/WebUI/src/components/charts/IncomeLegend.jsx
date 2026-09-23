import '../../styles/stackedChartStyles.css';

export default function IncomeLegend({ incomeData }) {
    if (!incomeData || incomeData.length <= 1) return null;

    return (
        <div className="income-legend">
            <span className="income-legend-line" />
            <span className="income-legend-text">Income</span>
        </div>
    );
}   