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
    } = useApp();

    const {
        hasData, allTimeChartData2, selectedSegment,
        effectiveOrder, isCustomOrder, updateOrder, resetOrder, persist, togglePersist,
        availableCategories, selectedCategories, setSelectedCategories, toggleItem, selectAll,
        monthWindow, yearWindowEntries,
        scrollMonthWindow, scrollYearWindow, jumpMonthWindowToYear,
        canScrollMonthBack, canScrollMonthForward,
        canScrollYearBack, canScrollYearForward,
        setMonthWindowByIndex, setYearWindowByIndex,
        monthSliderMaxIndex, monthSliderCurrentIndex,
        yearSliderMaxIndex, yearSliderCurrentIndex,
        buildStackDataFromEntries, incomeForEntries,
        monthBounds, yearBounds,
    } = useChartData();

    const chartReady = useDetailedChartReveal();

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

                <CategorySlicer
                    availableCategories={availableCategories}
                    selectedCategories={selectedCategories}
                    setSelectedCategories={setSelectedCategories}
                    toggleItem={toggleItem}
                    selectAll={selectAll}
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
                    buildStackDataFromEntries={buildStackDataFromEntries}
                    incomeForEntries={incomeForEntries}
                    monthBounds={monthBounds}
                    yearBounds={yearBounds}
                />

                <button className="charts-button" onClick={() => navigate(-1)}>
                    Back to Home
                </button>
            </div>
        </div>
    );
}