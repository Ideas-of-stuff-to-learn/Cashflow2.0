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
import ChartFootnote from '../components/charts/ChartFootnote';
import HomepageInfo from '../components/homepage/homepageInfo';
import ProgressBar from '../components/homepage/ProgressBar';
import ChartWindowSection from '../components/charts/ChartWindowSection';
import FilterPane from '../components/dashboard/FilterPane';

import '../styles/dashboardStyles.css';

export default function DashboardScreen() {
    const navigate = useNavigate();
    const {
        categorising, transactions, initialLoadError, retryInitialLoad, allTransactionsLoaded,
        contentsSelectedCategories, toggleContentsCategory, clearContentsCategories, categoryColors,
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
        buildStackDataFromEntries, incomeForEntries, selectedSegment,
    } = useChartData();
    const chartReady = useDetailedChartReveal();

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
                    {loading ? '...' : notYetCategorisedCount > 0 ? `Automatically categorise (retry ${notYetCategorisedCount})` : 'Automatically categorise'}
                </button>

                <button className="btn btn-secondary" onClick={() => navigate('/contents')}>
                    Go to Transactions
                </button>

                <button className="logout-btn" onClick={handleLogout}>Log Out</button>
            </div>

            <div className="dashboard-main">
                <div className="dashboard-charts-box">
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
                    <ChartFootnote />
                </div>
            </div>

            <FilterPane
                availableCategories={availableCategories}
                contentsSelectedCategories={contentsSelectedCategories}
                toggleContentsCategory={toggleContentsCategory}
                clearContentsCategories={clearContentsCategories}
                effectiveOrder={effectiveOrder}
                isCustomOrder={isCustomOrder}
                categoryColors={categoryColors}
                updateOrder={updateOrder}
                resetOrder={resetOrder}
                persist={persist}
                togglePersist={togglePersist}
            />
        </div>
    );
}