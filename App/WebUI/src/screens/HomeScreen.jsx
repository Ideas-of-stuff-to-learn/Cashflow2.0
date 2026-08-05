import { useApp } from '../AppContext';
import { useInitialLoadLogic } from '../customHooks/homescreen/useInitialLoadLogic';
import { useLogout } from '../customHooks/homescreen/useLogout';
import { useFilePicker } from '../customHooks/homescreen/useFilePicker';
import { useFileProcessor } from '../customHooks/homescreen/useFileProcessor';
import { NOT_YET_CATEGORISED } from '../checkingName';
import HomepageInfo from '../components/homepage/homepageInfo';
import ActionButtons from '../components/homepage/ActionButtons';
import '../styles/homePage.css'
import '../styles/shared.css'

export default function HomeScreen() {
    const {
        categorising, transactions, initialLoadError, retryInitialLoad, allTransactionsLoaded,
        uploadBreakdown, refetchUploadBreakdown,
    } = useApp();
    const { dateRangeInfo, refetchUploadCount } = useInitialLoadLogic();
    const { handleLogout } = useLogout();
    const { pickFiles, selectedFiles, status, setStatus, error, setError } = useFilePicker();
    const { processFiles, loading, progress } = useFileProcessor(setStatus, setError, selectedFiles);

    const notYetCategorisedCount = transactions.filter(t => t.category === NOT_YET_CATEGORISED).length;

    async function handleCategorisePress() {
        await processFiles();
        refetchUploadCount();
        refetchUploadBreakdown();
    }

    return (
        <div className="scroll-view">
            <div className="scroll-content">
                <HomepageInfo dateRangeInfo={dateRangeInfo} uploadBreakdown={uploadBreakdown} />

                {initialLoadError && (
                    <div className="banner">
                        <p className="banner-text">{initialLoadError}</p>
                        <button className="btn" style={{ marginTop: 8 }} onClick={retryInitialLoad}>
                            Retry
                        </button>
                    </div>
                )}

                <ActionButtons
                    pickFiles={pickFiles}
                    selectedFiles={selectedFiles}
                    loading={loading}
                    categorising={categorising}
                    status={status}
                    error={error}
                    progress={progress}
                    handleCategorisePress={handleCategorisePress}
                    notYetCategorisedCount={notYetCategorisedCount}
                    allTransactionsLoaded={allTransactionsLoaded}
                    handleLogout={handleLogout}
                    showGoToCharts
                />
            </div>
        </div>
    );
}