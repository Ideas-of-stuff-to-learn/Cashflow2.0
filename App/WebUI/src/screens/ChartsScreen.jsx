import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { useChartData } from '../customHooks/charts/useChartData';
import { useDetailedChartReveal } from '../customHooks/charts/useDetailedChartReveal';

import ChartWindowSection from '../components/charts/ChartWindowSection';
import ChartFootnote from '../components/charts/ChartFootnote';
import StatusBanners from '../components/charts/StatusBanners';
import FilterPane from '../components/dashboard/FilterPane';
import '../styles/chartStyles.css';

export default function ChartsScreen() {
    const navigate = useNavigate();
    const {
        categorising,
        initialLoading,
        processingStage,
        categoryColors,
        // NEW - this screen's OWN independent filter state, per
        // today's design: shared only with ContentsScreen-at-mobile-
        // width, never with Dashboard/FilterPane's contentsSelectedCategories.
        mobileSelectedCategories,
        toggleMobileCategory,
        toggleAllMobileCategories,
    } = useApp();

    const {
        hasData, selectedSegment,
        effectiveOrder, isCustomOrder, updateOrder, resetOrder, persist, togglePersist,
        availableCategories, setSelectedCategories: setChartSelectedCategories,
        monthBounds, yearBounds,
        monthWindow, yearWindowEntries,
        scrollMonthWindow, scrollYearWindow, jumpMonthWindowToYear,
        canScrollMonthBack, canScrollMonthForward,
        canScrollYearBack, canScrollYearForward,
        setMonthWindowByIndex, setYearWindowByIndex,
        monthSliderMaxIndex, monthSliderCurrentIndex,
        yearSliderMaxIndex, yearSliderCurrentIndex,
        monthSliderTrackMax, yearSliderTrackMax,
        buildStackDataFromEntries, incomeForEntries,
    } = useChartData();

    const chartReady = useDetailedChartReveal();

    // NEW - same one-way mirror pattern Dashboard.jsx already uses for
    // contentsSelectedCategories: whenever the shared mobile filter
    // state changes, copy it into this hook's own local chart-filter
    // state, so the chart's rendering reflects it. Never flows the
    // other direction - the chart itself doesn't write back to context.
    useEffect(() => {
        setChartSelectedCategories(new Set(mobileSelectedCategories));
    }, [mobileSelectedCategories, setChartSelectedCategories]);

    return (
        <div className="charts-container">
            <div className="charts-scroll-content">
                <StatusBanners initialLoading={initialLoading} processingStage={processingStage} />

                {/* Same combined category-selection + drag-to-reorder
                    pane as Dashboard's FilterPane, just laid out full-width
                    inline instead of as a docked sidebar (see
                    .charts-filter-wrap override in chartStyles.css). */}
                <div className="charts-filter-wrap">
                    <FilterPane
                        availableCategories={availableCategories}
                        contentsSelectedCategories={mobileSelectedCategories}
                        toggleContentsCategory={toggleMobileCategory}
                        toggleAllContentsCategories={toggleAllMobileCategories}
                        categoryColors={categoryColors}
                        effectiveOrder={effectiveOrder}
                        isCustomOrder={isCustomOrder}
                        updateOrder={updateOrder}
                        resetOrder={resetOrder}
                        persist={persist}
                        togglePersist={togglePersist}
                    />
                </div>

                <ChartWindowSection
                    ready={chartReady}
                    hasData={hasData}
                    monthWindow={monthWindow}
                    yearWindowEntries={yearWindowEntries}
                    scrollMonthWindow={scrollMonthWindow}
                    scrollYearWindow={scrollYearWindow}
                    jumpMonthWindowToYear={jumpMonthWindowToYear}
                    canScrollMonthBack={canScrollMonthBack}
                    canScrollMonthForward={canScrollMonthForward}
                    canScrollYearBack={canScrollYearBack}
                    canScrollYearForward={canScrollYearForward}
                    setMonthWindowByIndex={setMonthWindowByIndex}
                    setYearWindowByIndex={setYearWindowByIndex}
                    monthSliderMaxIndex={monthSliderMaxIndex}
                    monthSliderCurrentIndex={monthSliderCurrentIndex}
                    yearSliderMaxIndex={yearSliderMaxIndex}
                    yearSliderCurrentIndex={yearSliderCurrentIndex}
                    monthSliderTrackMax={monthSliderTrackMax}
                    yearSliderTrackMax={yearSliderTrackMax}
                    buildStackDataFromEntries={buildStackDataFromEntries}
                    incomeForEntries={incomeForEntries}
                    monthBounds={monthBounds}
                    yearBounds={yearBounds}
                />

                {selectedSegment && (
                    <p className="tapped-value-text">
                        {selectedSegment.month
                            ? `${selectedSegment.year}/${selectedSegment.month} — `
                            : `${selectedSegment.year} — `}
                        {selectedSegment.category}: £{selectedSegment.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                )}

                <ChartFootnote />

                <button className="charts-button" onClick={() => navigate(-1)}>
                    Back to Home
                </button>
            </div>
        </div>
    );
}
