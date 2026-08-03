import { useState } from 'react';
import '../../styles/chartStyles.css';
import SpendingStackChart from './SpendingStackedChart';
import LoadingBarsPlaceholder from '../loading/LoadingBarsPlaceholder';
import ChartWindowToggle from './chartWindowsToggle';
import SegmentPopupFixed from './SegmentPopupFixed';
import IncomeLegend from './IncomeLegend';
import RangeWindowSlider from './RangeWindowSlider';
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
    setMonthWindowByIndex, setYearWindowByIndex,
    monthSliderCurrentIndex, yearSliderCurrentIndex,
    monthSliderTrackMax, yearSliderTrackMax,
    monthBounds, yearBounds,
    buildStackDataFromEntries,
    incomeForEntries,
}) {
    const [heightScale, setHeightScale] = useState(1);
    const [mode, setMode] = useState('year');
    const { initialLoading, categorising, processingStage } = useApp();
    const { isLoading } = useDataReadiness(hasData, { initialLoading, categorising, processingStage });

    const { activeSegment, showSegment, handleChartMouseLeave: dismissOnHoverOut, handleChartBackgroundClick } = useSegmentPopup();

    function handleChartMouseLeave() {
        if (POPUP_VARIANT === 'fixed') return; // fixed only dismisses via click-outside, never hover-out
        dismissOnHoverOut();
    }    
    
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

    const canGoBack = mode === 'year' ? canScrollYearBack : canScrollMonthBack;
    const canGoForward = mode === 'year' ? canScrollYearForward : canScrollMonthForward;

    function handleScroll(direction) {
        if (mode === 'year') {
            scrollYearWindow(direction);
        } else {
            scrollMonthWindow(direction);
        }
    }

    // Full-history bounds (fixed, never change with the current
    // window) - the slider's labels always show the ENTIRE range the
    // person has data for, not just the current 12-item window.
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
                trackMax={mode === 'year' ? yearSliderTrackMax : monthSliderTrackMax}
                currentIndex={mode === 'year' ? yearSliderCurrentIndex : monthSliderCurrentIndex}
                onChangeIndex={mode === 'year' ? setYearWindowByIndex : setMonthWindowByIndex}
                startLabel={sliderStartLabel}
                endLabel={sliderEndLabel}
            />

            {POPUP_VARIANT === 'fixed' && <SegmentPopupFixed segment={activeSegment} />}
        </>
    );
}