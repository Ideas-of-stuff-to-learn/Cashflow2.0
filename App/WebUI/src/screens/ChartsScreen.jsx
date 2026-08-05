import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { useChartData } from '../customHooks/charts/useChartData';
import { useDetailedChartReveal } from '../customHooks/charts/useDetailedChartReveal';

import ChartWindowSection from '../components/charts/ChartWindowSection';
import SpendingOverview from '../components/charts/SpendingOverview';
import CategorySlicer from '../components/charts/categorySlicer';
import StatusBanners from '../components/charts/StatusBanners';
import StackOrderEditor from '../components/charts/StackOrderEditor';
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
        hasData, allTimeChartData2, selectedSegment,
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
                <h1 className="charts-title">Spending by Category</h1>
                <StatusBanners initialLoading={initialLoading} processingStage={processingStage} />

                <SpendingOverview
                    hasData={hasData}
                    filteredChartData2={allTimeChartData2}
                    categorising={categorising}
                    initialLoading={initialLoading}
                    selectedBar={null}
                />

                {/* CategorySlicer's own checkbox clicks now write
                    DIRECTLY to the shared context state (mobileSelectedCategories),
                    not to useChartData's local mirror - the mirror only
                    ever flows context -> local, via the effect above. */}
                <CategorySlicer
                    availableCategories={availableCategories}
                    selectedCategories={mobileSelectedCategories}
                    toggleCategory={toggleMobileCategory}
                    toggleAllCategories={toggleAllMobileCategories}
                    categoryColors={categoryColors}
                />

                <StackOrderEditor
                    effectiveOrder={effectiveOrder}
                    isCustomOrder={isCustomOrder}
                    updateOrder={updateOrder}
                    resetOrder={resetOrder}
                    persist={persist}
                    togglePersist={togglePersist}
                />

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

                <button className="charts-button" onClick={() => navigate(-1)}>
                    Back to Home
                </button>
            </div>
        </div>
    );
}