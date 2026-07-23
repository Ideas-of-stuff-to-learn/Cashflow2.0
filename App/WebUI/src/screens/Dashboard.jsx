import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { useInitialLoadLogic } from '../customHooks/homescreen/useInitialLoadLogic';
import { useLogout } from '../customHooks/homescreen/useLogout';
import { useFilePicker } from '../customHooks/homescreen/useFilePicker';
import { useFileProcessor } from '../customHooks/homescreen/useFileProcessor';
import { useChartData } from '../customHooks/charts/useChartData';
import { useDetailedChartReveal } from '../customHooks/charts/useDetailedChartReveal';
import { NOT_YET_CATEGORISED } from '../checkingName';

import HomepageInfo from '../components/homepage/homepageInfo';
import YearlyChartSection from '../components/charts/YearlyChartSection';
import DetailedChartSection from '../components/charts/DetailedChartSection';
import FilterPane from '../components/dashboard/FilterPane';

import '../styles/dashboardStyles.css';

export default function DashboardScreen() {
    const navigate = useNavigate();
    const {
        categorising, transactions, initialLoadError, retryInitialLoad, allTransactionsLoaded,
        contentsSelectedCategories, toggleContentsCategory, clearContentsCategories,
    } = useApp();
    const { dateRangeInfo, uploadCount, refetchUploadCount } = useInitialLoadLogic();
    const { handleLogout } = useLogout();
    const { pickFiles, selectedFiles, status, setStatus, error, setError } = useFilePicker();
    const { processFiles, loading } = useFileProcessor(setStatus, setError, selectedFiles);
    const notYetCategorisedCount = transactions.filter(t => t.category === NOT_YET_CATEGORISED).length;

    async function handleCategorisePress() {
        await processFiles();
        refetchUploadCount();
    }

    const {
        hasData, effectiveOrder, updateOrder, resetOrder, persist, togglePersist, isCustomOrder,
        yearChartData, yearIncomeLineData, selectedYear, selectedYearSegment, selectedYearTotal,
        monthChartData, monthIncomeLineData, selectedSegment, showingDummyData, closeDrilldown,
        availableCategories, setSelectedCategories: setChartSelectedCategories,
    } = useChartData();
    const showYearChart = useDetailedChartReveal();

    // Chart's own selectedCategories is a one-way mirror of the
    // persistent contentsSelectedCategories (lifted to AppContext) -
    // NOT an independent second copy. This is what keeps Dashboard's
    // charts, Dashboard's FilterPane, and ContentsScreen's own filter
    // all showing the same selection, in both directions, and
    // surviving navigation between the two screens.
    useEffect(() => {
        setChartSelectedCategories(new Set(contentsSelectedCategories));
    }, [contentsSelectedCategories, setChartSelectedCategories]);

    return (
        <div className="dashboard-flex">
            <div className="dashboard-home-box">
                <HomepageInfo dateRangeInfo={dateRangeInfo} uploadCount={uploadCount} />
                {initialLoadError && (
                    <div className="banner">
                        <p className="banner-text">{initialLoadError}</p>
                        <button className="btn" onClick={retryInitialLoad}>Retry</button>
                    </div>
                )}
                <button className="btn" onClick={pickFiles} disabled={loading || categorising}>Choose CSV Files</button>
                {selectedFiles.length > 0 && (
                    <div className="file-info">
                        {selectedFiles.map(f => <p key={f.name} className="file-info-text">{f.name}</p>)}
                    </div>
                )}
                {status && <p className="status">{status}</p>}
                {error && <p className="error">{error}</p>}
                <button
                    className="btn btn-secondary"
                    onClick={handleCategorisePress}
                    disabled={loading || categorising || !allTransactionsLoaded || (selectedFiles.length === 0 && notYetCategorisedCount === 0)}
                >
                    {loading ? '...' : notYetCategorisedCount > 0 ? `Categorise (retry ${notYetCategorisedCount})` : 'Categorise'}
                </button>

                <button className="btn btn-secondary" onClick={() => navigate('/contents')}>
                    Go to CSV Contents
                </button>

                <button className="logout-btn" onClick={handleLogout}>Log Out</button>
            </div>

            <div className="dashboard-main">
                <div className="dashboard-charts-box">
                    <YearlyChartSection
                        ready={showYearChart} hasData={hasData} showingDummyData={showingDummyData}
                        yearChartData={yearChartData} yearIncomeLineData={yearIncomeLineData}
                        selectedYear={selectedYear} selectedYearSegment={selectedYearSegment}
                        selectedYearTotal={selectedYearTotal}
                    />
                    <DetailedChartSection
                        selectedYear={selectedYear} monthChartData={monthChartData}
                        monthIncomeLineData={monthIncomeLineData} selectedSegment={selectedSegment}
                        closeDrilldown={closeDrilldown}
                    />
                </div>
            </div>

            <FilterPane
                availableCategories={availableCategories}
                contentsSelectedCategories={contentsSelectedCategories}
                toggleContentsCategory={toggleContentsCategory}
                clearContentsCategories={clearContentsCategories}
                effectiveOrder={effectiveOrder}
                isCustomOrder={isCustomOrder}
                updateOrder={updateOrder}
                resetOrder={resetOrder}
                persist={persist}
                togglePersist={togglePersist}
            />
        </div>
    );
}