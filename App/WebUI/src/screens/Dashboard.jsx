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
import ProgressBar from '../components/homepage/ProgressBar';
import YearlyChartSection from '../components/charts/Yearlychartsection';
import DetailedChartSection from '../components/charts/DetailedChartSection';
import FilterPane from '../components/dashboard/FilterPane';

import '../styles/dashboardStyles.css';
import '../styles/shared.css';

export default function DashboardScreen() {
    const navigate = useNavigate();
    const {
        categorising, transactions, initialLoadError, retryInitialLoad, allTransactionsLoaded,
        contentsSelectedCategories, toggleContentsCategory, clearContentsCategories,
    } = useApp();
    const { dateRangeInfo, uploadCount, refetchUploadCount } = useInitialLoadLogic();
    const { handleLogout } = useLogout();
    const { pickFiles, selectedFiles, status, setStatus, error, setError } = useFilePicker();
    const { processFiles, loading, progress } = useFileProcessor(setStatus, setError, selectedFiles);
    const notYetCategorisedCount = transactions.filter(t => t.category === NOT_YET_CATEGORISED).length;

    async function handleCategorisePress() {
        await processFiles();
        refetchUploadCount();
    }

    const {
        hasData, effectiveOrder, updateOrder, resetOrder, persist, togglePersist, isCustomOrder,
        yearChartData, yearIncomeLineData, selectedYear, selectedYearSegment, selectedYearTotal,
        monthChartData, monthIncomeLineData, selectedSegment, closeDrilldown,
        availableCategories, setSelectedCategories: setChartSelectedCategories,categoryColors,
    } = useChartData();
    const showYearChart = useDetailedChartReveal();

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
                <button className="btn" onClick={pickFiles} disabled={loading || categorising}>Choose CSV or Excel Files</button>
                {selectedFiles.length > 0 && (
                    <div className="file-info">
                        {selectedFiles.map(f => <p key={f.name} className="file-info-text">{f.name}</p>)}
                    </div>
                )}
                <ProgressBar progress={progress} status={status} />
                {error && <p className="error">{error}</p>}
                <button
                    className="btn btn-secondary"
                    onClick={handleCategorisePress}
                    disabled={loading || categorising || !allTransactionsLoaded || (selectedFiles.length === 0 && notYetCategorisedCount === 0)}
                >
                    {loading ? '...' : notYetCategorisedCount > 0 ? `Reprocess (retry ${notYetCategorisedCount})` : 'Process transactions'}
                </button>

                <button className="btn btn-secondary" onClick={() => navigate('/contents')}>
                    Go to Transactions
                </button>

                <button className="logout-btn" onClick={handleLogout}>Log Out</button>
            </div>

            <div className="dashboard-main">
                <div className="dashboard-charts-box">
                    <YearlyChartSection
                        ready={showYearChart} hasData={hasData}
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
                categoryColors={categoryColors}
            />
        </div>
    );
}