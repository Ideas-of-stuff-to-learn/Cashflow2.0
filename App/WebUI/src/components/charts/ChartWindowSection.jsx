import { useState } from 'react';
import '../../styles/chartStyles.css';
import SpendingStackChart from './SpendingStackedChart';
import LoadingBarsPlaceholder from '../loading/LoadingBarsPlaceholder';
import ChartWindowToggle from './chartWindowsToggle';
import SegmentPopupFixed from './SegmentPopupFixed';
import IncomeLegend from './IncomeLegend';
import { useDataReadiness } from '../../customHooks/charts/useDataReadiness';
import { useSegmentPopup } from '../../customHooks/charts/useSegmentPopup';
import { useApp } from '../../AppContext';

const POPUP_VARIANT = 'fixed'; // 'fixed' | 'floating' | 'modal'

export default function ChartWindowSection({
    ready, hasData,
    monthWindow, yearWindowEntries,
    scrollMonthWindow, scrollYearWindow, jumpMonthWindowToYear,
    canScrollMonthBack, canScrollMonthForward,
    canScrollYearBack, canScrollYearForward,
    buildStackDataFromEntries,
    incomeForEntries,
}) {
    const [heightScale, setHeightScale] = useState(1);
    const [mode, setMode] = useState('year');
    const { initialLoading, categorising, processingStage } = useApp();
    const { isLoading } = useDataReadiness(hasData, { initialLoading, categorising, processingStage });

    const { activeSegment, showSegment, handleChartMouseLeave, handleChartBackgroundClick } = useSegmentPopup();

    function handleSegmentInteract(segmentData, key, cursorPos) {
        showSegment({ ...segmentData, _positionKey: key, _cursorPos: cursorPos });
    }

    if (!ready) return null;

    if (!hasData) {
        return (
            <LoadingBarsPlaceholder
                message={isLoading ? 'Preparing your charts...' : 'No categorised transactions yet — upload a CSV to see charts.'}
            />
        );
    }

    const activeEntries = mode === 'year' ? yearWindowEntries : monthWindow;
    const stackData = buildStackDataFromEntries(activeEntries, mode === 'year' ? jumpMonthWindowToYear : null);
    const incomeData = incomeForEntries(activeEntries);

    // Which pair of booleans applies depends on which mode is active -
    // scrolling year vs month are independent windows with their own
    // separate bounds.
    const canGoBack = mode === 'year' ? canScrollYearBack : canScrollMonthBack;
    const canGoForward = mode === 'year' ? canScrollYearForward : canScrollMonthForward;

    function handleScroll(direction) {
        if (mode === 'year') {
            scrollYearWindow(direction);
        } else {
            scrollMonthWindow(direction);
        }
    }

    return (
        <>
            <div className="chart-header-row">
                <IncomeLegend incomeData={incomeData} />
                <ChartWindowToggle mode={mode} setMode={setMode} />
            </div>

            <p className="section-label">
                {mode === 'year' ? 'Spending by year' : 'Spending by month'} — tap a segment for details
            </p>

            <div className="window-scroll-row">
                <SpendingStackChart
                    stackData={stackData}
                    incomeData={incomeData}
                    heightScale={heightScale}
                    popupVariant={POPUP_VARIANT}
                    activeSegment={activeSegment}
                    onSegmentInteract={handleSegmentInteract}
                    onChartMouseLeave={handleChartMouseLeave}
                    onChartBackgroundClick={handleChartBackgroundClick}
                />
            </div>

            {/* Each arrow only renders at all when that direction is
                actually possible - reappears the moment scrolling the
                OTHER direction makes it possible again, since canGoBack/
                canGoForward are recomputed fresh every render from the
                actual current window position. */}
            <div className="window-nav-row">
                {canGoBack && (
                    <button className="window-nav-btn" onClick={() => handleScroll(-1)}>◀</button>
                )}
                {canGoForward && (
                    <button className="window-nav-btn" onClick={() => handleScroll(1)}>▶</button>
                )}
            </div>

            {POPUP_VARIANT === 'fixed' && <SegmentPopupFixed segment={activeSegment} />}
        </>
    );
}