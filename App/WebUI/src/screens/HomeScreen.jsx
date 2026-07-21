import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { useInitialLoadLogic } from '../customHooks/homescreen/useInitialLoadLogic';
import { useLogout } from '../customHooks/homescreen/useLogout';
import { useFilePicker } from '../customHooks/homescreen/useFilePicker';
import { useFileProcessor } from '../customHooks/homescreen/useFileProcessor';
import { NOT_YET_CATEGORISED } from '../checkingName';
import HomepageInfo from '../components/homepage/homepageInfo';
import '../styles/homePage.css'

export default function HomeScreen() {
    const navigate = useNavigate();
    const { categorising, transactions, initialLoadError, retryInitialLoad, allTransactionsLoaded } = useApp();
    const { dateRangeInfo, uploadCount, refetchUploadCount } = useInitialLoadLogic();
    const { handleLogout } = useLogout();
    const { pickFiles, selectedFiles, status, setStatus, error, setError } = useFilePicker();
    const { processFiles, loading } = useFileProcessor(setStatus, setError, selectedFiles);

    const notYetCategorisedCount = transactions.filter(t => t.category === NOT_YET_CATEGORISED).length;

    async function handleCategorisePress() {
        await processFiles();
        refetchUploadCount();
    }

    return (
        <div className="scroll-view">
            <div className="scroll-content">
                <HomepageInfo dateRangeInfo={dateRangeInfo} uploadCount={uploadCount} />

                {initialLoadError && (
                    <div className="banner">
                        <p className="banner-text">{initialLoadError}</p>
                        <button className="btn" style={{ marginTop: 8 }} onClick={retryInitialLoad}>
                            Retry
                        </button>
                    </div>
                )}

                <button className="btn" onClick={pickFiles} disabled={loading || categorising}>
                    Choose CSV Files
                </button>

                {selectedFiles.length > 0 && (
                    <div className="file-info">
                        <p className="file-info-text">
                            Current file{selectedFiles.length > 1 ? 's' : ''}:
                        </p>
                        {selectedFiles.map(f => (
                            <p key={f.uri || f.name} className="file-info-text">
                                {f.name} ({(f.size / 1024).toFixed(1)} KB)
                            </p>
                        ))}
                    </div>
                )}
                {status && <p className="status">{status}</p>}
                {error && <p className="error">{error}</p>}

                <button
                    className="btn btn-secondary"
                    onClick={handleCategorisePress}
                    disabled={loading || categorising || !allTransactionsLoaded || (selectedFiles.length === 0 && notYetCategorisedCount === 0)}
                >
                    {loading
                        ? '...'
                        : notYetCategorisedCount > 0
                            ? `Categorise${selectedFiles.length > 0 ? '' : ` (retry ${notYetCategorisedCount})`}`
                            : 'Categorise'}
                </button>

                <button className="btn btn-secondary" onClick={() => navigate('/charts')}>
                    Go to Charts
                </button>

                <button className="btn btn-secondary" onClick={() => navigate('/contents')}>
                    Go to CSV Contents
                </button>

                <button className="logout-btn" onClick={handleLogout}>
                    Log Out
                </button>
            </div>
        </div>
    );
}