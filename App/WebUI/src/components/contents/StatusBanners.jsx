import '../../styles/contentsStyles.css';
import { ROW_HEIGHT } from '../../utils/contentsscreen/contentsUtils';


export default function StatusBanners({
    outOfSyncMessage,
    initialLoading,
    initialLoadError,
    onRetry,
    categorising,
}) {
    return (
        <>
            {outOfSyncMessage && (
                <div className="out-of-sync-banner">
                    <p className="out-of-sync-banner-text">⚠️ {outOfSyncMessage}</p>
                </div>
            )}

            {initialLoading && (
                <div className="banner">
                    {initialLoadError ? (
                        <>
                            <p className="banner-text">{initialLoadError}</p>
                            <button className="button" style={{ marginTop: 8 }} onClick={onRetry}>
                                Retry
                            </button>
                        </>
                    ) : (
                        <p className="banner-text">⏳ Loading your data...</p>
                    )}
                </div>
            )}

            {categorising && (
                <div className="banner">
                    <p className="banner-text">⏳ Categorising in background...</p>
                </div>
            )}
        </>
    );
}