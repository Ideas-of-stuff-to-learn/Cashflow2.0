import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import SpendingOverview from '../components/charts/SpendingOverview';
import YearlyChartSection from '../components/charts/Yearlychartsection';
import CategorySlicer from '../components/charts/categorySlicer';
import DetailedChartSection from '../components/charts/DetailedChartSection';
import StatusBanners from '../components/charts/StatusBanners';
import StackOrderEditor from '../components/charts/StackOrderEditor';
import { useChartData } from '../customHooks/charts/useChartData';
import { useDetailedChartReveal } from '../customHooks/charts/useDetailedChartReveal';
import '../styles/chartStyles.css';

export default function ChartsScreen() {
    const navigate = useNavigate();
    const {
        categorising,
        initialLoading,
        processingStage,
    } = useApp();

    const {
        showingDummyData,
        hasData,
        effectiveOrder,
        updateOrder,
        resetOrder,
        persist,
        togglePersist,
        isCustomOrder,
        yearChartData,
        yearIncomeLineData,
        allTimeChartData2,
        selectedBar,
        selectedYear,
        selectedYearSegment,
        selectedYearTotal,
        monthChartData,
        monthIncomeLineData,
        selectedSegment,
        availableCategories,
        selectedCategories,
        setSelectedCategories,
        toggleItem,
        selectAll,
        closeDrilldown,
    } = useChartData();

    const showYearChart = useDetailedChartReveal();

    return (
        <div className="charts-container">
            <div className="charts-scroll-content">
                <h1 className="charts-title">Spending by Category</h1>
                <StatusBanners initialLoading={initialLoading} processingStage={processingStage} showingDummyData={showingDummyData} />

                <SpendingOverview
                    hasData={hasData}
                    filteredChartData2={allTimeChartData2}
                    categorising={categorising}
                    initialLoading={initialLoading}
                    selectedBar={selectedBar}
                />

                <CategorySlicer
                    availableCategories={availableCategories}
                    selectedCategories={selectedCategories}
                    setSelectedCategories={setSelectedCategories}
                    toggleItem={toggleItem}
                    selectAll={selectAll}
                />

                <StackOrderEditor
                    effectiveOrder={effectiveOrder}
                    isCustomOrder={isCustomOrder}
                    updateOrder={updateOrder}
                    resetOrder={resetOrder}
                    persist={persist}
                    togglePersist={togglePersist}
                />

                <YearlyChartSection
                    ready={showYearChart}
                    hasData={hasData}
                    showingDummyData={showingDummyData}
                    yearChartData={yearChartData}
                    yearIncomeLineData={yearIncomeLineData}
                    selectedYear={selectedYear}
                    selectedYearSegment={selectedYearSegment}
                    selectedYearTotal={selectedYearTotal}
                />

                <DetailedChartSection
                    selectedYear={selectedYear}
                    monthChartData={monthChartData}
                    monthIncomeLineData={monthIncomeLineData}
                    selectedSegment={selectedSegment}
                    closeDrilldown={closeDrilldown}
                />

                <button className="charts-button" onClick={() => navigate(-1)}>
                    Back to Home
                </button>
            </div>
        </div>
    );
}