import { useState } from 'react';
import '../../styles/chartStyles.css';
import SpendingStackChart from './SpendingStackedChart';
import LoadingBarsPlaceholder from '../loading/LoadingBarsPlaceholder';
import ChartWindowToggle from './chartWindowsToggle';
import SegmentPopupFixed from './SegmentPopupFixed';
import { useDataReadiness } from '../../customHooks/charts/useDataReadiness';
import { useSegmentPopup } from '../../customHooks/charts/useSegmentPopup';
import { useModalSegmentPopup } from '../../customHooks/charts/useModalSegmentPopup';
import { useApp } from '../../AppContext';

const POPUP_VARIANT = 'floating'; // 'fixed' | 'floating' | 'modal'

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

    const fixedFloating = useSegmentPopup();
    const modal = useModalSegmentPopup();
    const isModal = POPUP_VARIANT === 'modal';
    const activeSegment = isModal ? modal.activeSegment : fixedFloating.activeSegment;

    function handleSegmentInteract(segmentData, key) {
        const withKey = { ...segmentData, _positionKey: key };
        if (isModal) {
            modal.showSegment(withKey);
        } else {
            fixedFloating.showSegment(withKey);
        }
    }

    function handleChartMouseLeave() {
        if (!isModal) fixedFloating.handleChartMouseLeave();
    }

    function handleChartBackgroundClick() {
        if (!isModal) fixedFloating.handleChartBackgroundClick();
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
                <SpendingStackChart
                    stackData={stackData}
                    incomeData={incomeData}
                    heightScale={heightScale}
                    popupVariant={POPUP_VARIANT}
                    activeSegment={activeSegment}
                    onSegmentInteract={handleSegmentInteract}
                    onChartMouseLeave={handleChartMouseLeave}
                    onChartBackgroundClick={handleChartBackgroundClick}
                    onPopupMouseLeave={isModal ? modal.handlePopupMouseLeave : undefined}
                    onPopupClickOutside={isModal ? modal.handleClickOutsidePopup : undefined}
                />
                <button className="window-scroll-btn" onClick={() => handleScroll(1)}>▶</button>
            </div>

            {POPUP_VARIANT === 'fixed' && <SegmentPopupFixed segment={activeSegment} />}
        </>
    );
}