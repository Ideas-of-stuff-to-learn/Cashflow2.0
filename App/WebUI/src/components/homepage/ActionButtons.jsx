import { useNavigate } from 'react-router-dom';
import ProgressBar from './ProgressBar';

// Shared button cluster used identically by both HomeScreen and
// Dashboard - editing wording/order here updates both places at once.
// showGoToCharts is a flag, not a separate prop threaded through by
// the caller reconstructing layout around this component - this
// component owns the full fixed order internally (Choose file -> file
// list -> progress -> error -> Categorise -> [Charts, if flagged] ->
// Transactions -> Logout), and the flag just switches whether the
// Charts button renders in its one fixed spot.
export default function ActionButtons({
    pickFiles, selectedFiles, loading, categorising,
    status, error, progress,
    handleCategorisePress, notYetCategorisedCount, allTransactionsLoaded,
    handleLogout,
    showGoToCharts = false,
}) {
    const navigate = useNavigate();

    return (
        <>
            <button className="btn" onClick={pickFiles} disabled={loading || categorising}>
                Choose CSV or Excel Files
            </button>

            {selectedFiles.length > 0 && (
                <div className="file-info">
                    {selectedFiles.map(f => (
                        <p key={f.uri || f.name} className="file-info-text">
                            {f.name}
                        </p>
                    ))}
                </div>
            )}
            <ProgressBar progress={progress} status={status} />
            {error && <p className="error">{error}</p>}

            <button
                className="btn btn-secondary"
                onClick={handleCategorisePress}
                disabled={loading || categorising || !allTransactionsLoaded || (selectedFiles.length === 0 && notYetCategorisedCount === 0)}
            >
                {loading
                    ? '...'
                    : notYetCategorisedCount > 0
                        ? `Automatically categorise (retry ${notYetCategorisedCount})`
                        : 'Automatically categorise'}
            </button>

            {showGoToCharts && (
                <button className="btn btn-secondary" onClick={() => navigate('/charts')}>
                    Go to Charts
                </button>
            )}

            <button className="btn btn-secondary" onClick={() => navigate('/contents')}>
                Go to Transactions
            </button>

            <button className="logout-btn" onClick={handleLogout}>
                Log Out
            </button>
        </>
    );
}