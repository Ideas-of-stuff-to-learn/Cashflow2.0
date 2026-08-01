import { useState } from 'react';
import '../../styles/chartStyles.css';
import SpendingStackChart from './SpendingStackedChart';
import LoadingBarsPlaceholder from '../loading/LoadingBarsPlaceholder';
import ChartWindowToggle from './chartWindowsToggle';
import { useDataReadiness } from '../../customHooks/charts/useDataReadiness';
import { useApp } from '../../AppContext';

// Replaces YearlyChartSection + DetailedChartSection. One chart, one
// toggle (top-right) switching between the year window and the month
// window - both windows' raw entries come in as props (from
// useChartData/useChartWindows), this component just decides which
// one to actually build/render based on `mode`, calling the shared
// buildStackDataFromEntries/incomeForEntries functions on demand.
export default function ChartWindowSection({
    ready, hasData,
    monthWindow, yearWindowEntries,
    scrollMonthWindow, scrollYearWindow, jumpMonthWindowToYear,
    buildStackDataFromEntries,
    incomeForEntries,
}) {
    const [heightScale, setHeightScale] = useState(1);
    const [mode, setMode] = useState('year');
    const { initialLoading, categorising, processingStage } = useApp();
    const { isLoading } = useDataReadiness(hasData, { initialLoading, categorising, processingStage });

    if (!ready) return null;

    if (!hasData) {
        return (
            <LoadingBarsPlaceholder
                message={isLoading ? 'Preparing your charts...' : 'No categorised transactions yet — upload a CSV to see charts.'}
            />
        );
    }

    const activeEntries = mode === 'year' ? yearWindowEntries : monthWindow;
    const stackData = buildStackDataFromEntries(activeEntries);
    const incomeData = incomeForEntries(activeEntries);

    function handleScroll(direction) {
        if (mode === 'year') {
            scrollYearWindow(direction);
        } else {
            scrollMonthWindow(direction);
        }
    }

    return (
        <>
            <ChartWindowToggle mode={mode} setMode={setMode} />
            <p className="section-label">
                {mode === 'year' ? 'Spending by year' : 'Spending by month'} — tap a segment for details
            </p>

            <div className="zoom-row">
                <span className="section-label">Zoom: {heightScale.toFixed(1)}x</span>
                <input type="range" className="zoom-slider" min={1} max={5} step={0.5}
                    value={heightScale} onChange={e => setHeightScale(parseFloat(e.target.value))} />
            </div>

            <div className="window-scroll-row">
                <button className="window-scroll-btn" onClick={() => handleScroll(-1)}>◀</button>
                <SpendingStackChart stackData={stackData} incomeData={incomeData} heightScale={heightScale} />
                <button className="window-scroll-btn" onClick={() => handleScroll(1)}>▶</button>
            </div>
        </>
    );
}