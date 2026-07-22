import { useState } from 'react';
import '../../styles/chartStyles.css';
import SpendingStackChart from './SpendingStackedChart';
import { monthLabel } from '../../utils/charts/yearlyChartUtils';

export default function DetailedChartSection({
    selectedYear,
    monthChartData,
    monthIncomeLineData,
    selectedSegment,
    closeDrilldown,
}) {
    const [heightScale, setHeightScale] = useState(1);

    if (selectedYear == null) return null;

    return (
        <>
            <p className="section-label">{selectedYear} by month</p>
            <button className="chip-text" onClick={closeDrilldown} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                Close ✕
            </button>

            <p className="section-label">Zoom: {heightScale.toFixed(1)}x</p>
            <input
                type="range"
                className="zoom-slider"
                min={1}
                max={5}
                step={0.5}
                value={heightScale}
                onChange={e => setHeightScale(parseFloat(e.target.value))}
            />

            <SpendingStackChart
                stackData={monthChartData}
                incomeData={monthIncomeLineData}
                heightScale={heightScale}
            />

            {selectedSegment && (
                <p className="tapped-value-text">
                    {monthLabel(selectedSegment.month)} {selectedSegment.year} — {selectedSegment.category}: £{selectedSegment.value.toFixed(2)}
                </p>
            )}
        </>
    );
}