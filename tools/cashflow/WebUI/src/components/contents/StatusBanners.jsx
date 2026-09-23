import '../../styles/contentsStyles.css';

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
                <div className="status-card-wrap">
                    {initialLoadError ? (
                        <div className="status-card status-card-error">
                            <p className="status-card-label">Connection error</p>
                            <p className="status-card-body">{initialLoadError}</p>
                            <button className="status-card-retry" onClick={onRetry}>
                                Retry
                            </button>
                        </div>
                    ) : (
                        <div className="status-card">
                            <div className="status-card-spinner" />
                            <p className="status-card-body">Loading your data…</p>
                        </div>
                    )}
                </div>
            )}

            {categorising && (
                <div className="status-card-wrap">
                    <div className="status-card">
                        <div className="status-card-spinner" />
                        <p className="status-card-body">Categorising in background…</p>
                    </div>
                </div>
            )}
        </>
    );
}
