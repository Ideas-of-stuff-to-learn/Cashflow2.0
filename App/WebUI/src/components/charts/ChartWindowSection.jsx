import { useState } from 'react';
import '../../styles/chartStyles.css';
import SpendingStackChart from './SpendingStackedChart';
import LoadingBarsPlaceholder from '../loading/LoadingBarsPlaceholder';
import ChartWindowToggle from './chartWindowsToggle';
import SegmentPopupFixed from './SegmentPopupFixed';
import IncomeLegend from './IncomeLegend';
import RangeWindowSlider from './RangeWindowSlider'
import { useDataReadiness } from '../../customHooks/charts/useDataReadiness';
import { useSegmentPopup } from '../../customHooks/charts/useSegmentPopup';
import { useApp } from '../../AppContext';


const POPUP_VARIANT = 'fixed'; // 'fixed' | 'floating' | 'modal'

export default function ChartWindowSection({
    ready, hasData,
    monthBounds, yearBounds,
    monthWindow, yearWindowEntries,
    scrollMonthWindow, scrollYearWindow, jumpMonthWindowToYear,
    canScrollMonthBack, canScrollMonthForward,
    canScrollYearBack, canScrollYearForward,
    setMonthWindowByIndex, setYearWindowByIndex,
    monthSliderMaxIndex, monthSliderCurrentIndex,
    yearSliderMaxIndex, yearSliderCurrentIndex,
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

    // FIXED - these now show the ABSOLUTE earliest/latest across ALL
    // the user's data, not the current window's edges. The slider
    // should always represent "here is your whole history," with the
    // current 12-item window just being WHERE on that timeline you
    // currently are - not redefine what the timeline's endpoints are
    // every time you drag.
    const sliderStartLabel = mode === 'year'
        ? String(yearBounds?.earliestYear ?? '')
        : monthBounds ? `${monthBounds.earliest.month}/${monthBounds.earliest.year}` : '';
    const sliderEndLabel = mode === 'year'
        ? String(yearBounds?.latestYear ?? '')
        : monthBounds ? `${monthBounds.latest.month}/${monthBounds.latest.year}` : '';
        
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
                <button
                    className="window-nav-btn"
                    style={{ visibility: canGoBack ? 'visible' : 'hidden' }}
                    onClick={() => handleScroll(-1)}
                >
                    ◀
                </button>
                <button
                    className="window-nav-btn"
                    style={{ visibility: canGoForward ? 'visible' : 'hidden' }}
                    onClick={() => handleScroll(1)}
                >
                    ▶
                </button>
            </div>
            <RangeWindowSlider
                maxIndex={mode === 'year' ? yearSliderMaxIndex : monthSliderMaxIndex}
                currentIndex={mode === 'year' ? yearSliderCurrentIndex : monthSliderCurrentIndex}
                onChangeIndex={mode === 'year' ? setYearWindowByIndex : setMonthWindowByIndex}
                startLabel={sliderStartLabel}
                endLabel={sliderEndLabel}
            />

            {POPUP_VARIANT === 'fixed' && <SegmentPopupFixed segment={activeSegment} />}
        </>
    );
}