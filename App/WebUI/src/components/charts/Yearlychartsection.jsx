import { useState } from 'react';
import '../../styles/chartStyles.css';
import SpendingStackChart from './SpendingStackedChart';

export default function YearlyChartSection({
    ready,
    hasData,
    showingDummyData,
    yearChartData,
    yearIncomeLineData,
    selectedYear,
    selectedYearSegment,
    selectedYearTotal,
}) {
    const [heightScale, setHeightScale] = useState(1);

    if (!ready) return null;

    if (!hasData) {
        return <p className="empty-text">No categorised transactions yet — upload a CSV to see charts.</p>;
    }

    return (
        <>
            {showingDummyData && (
                <p className="empty-text">Showing example data while we categorise your transactions…</p>
            )}
            <p className="section-label">Spending by year — tap a segment to see months</p>
            <div className="zoom-row">
                <span className="section-label">Segment scale: {heightScale.toFixed(1)}x</span>
                <input
                    type="range"
                    className="zoom-slider"
                    min={1}
                    max={5}
                    step={0.5}
                    value={heightScale}
                    onChange={e => setHeightScale(parseFloat(e.target.value))}
                />
            </div>
            <SpendingStackChart
                stackData={yearChartData}
                incomeData={yearIncomeLineData}
                heightScale={heightScale}
            />
            {selectedYearSegment && (
                <p className="tapped-value-text">
                    {selectedYearSegment.year} — {selectedYearSegment.category}: £{selectedYearSegment.value.toFixed(2)}
                </p>
            )}
            {selectedYear != null && (
                <p className="tapped-value-text">
                    {selectedYear} total: £{selectedYearTotal.toFixed(2)}
                </p>
            )}
        </>
    );
}