import '../../styles/chartStyles.css';

export default function StatusBanners({ initialLoading, processingStage, showingDummyData }) {
    return (
        <>
            {initialLoading && <div className="banner"><p className="banner-text">⏳ Loading your data...</p></div>}
            {showingDummyData && <div className="banner"><p className="banner-text">📊 Dummy data - checking previous categorisations...</p></div>}
            {processingStage === 'waitingForLLM' && <div className="banner"><p className="banner-text">✓ Cached data loaded - finishing categorisation...</p></div>}
            {processingStage === 'parsing' && <div className="banner"><p className="banner-text">⏳ Preparing your transactions...</p></div>}
        </>
    );
}