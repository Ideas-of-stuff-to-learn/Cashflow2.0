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
    duplicateNotice = null,
    onDismissDuplicateNotice,
}) {
    const navigate = useNavigate();

    const hasDuplicates = duplicateNotice && (
        duplicateNotice.filenames.length > 0 ||
        duplicateNotice.contents.length > 0 ||
        (duplicateNotice.batchCopies ?? []).length > 0
    );

    return (
        <>
            {hasDuplicates && (
                <div className="modal-backdrop">
                    <div className="modal-card modal-card-narrow">
                        <h1 className="modal-title" style={{ fontSize: 20, marginBottom: 12 }}>No action needed</h1>
                        {duplicateNotice.successfulCount > 0 && (
                            <p className="modal-desc duplicate-success-line">
                                {duplicateNotice.successfulCount} file{duplicateNotice.successfulCount !== 1 ? 's' : ''} successfully uploaded.
                            </p>
                        )}
                        {(duplicateNotice.batchCopies ?? []).length > 0 && (
                            <div className="duplicate-section">
                                <p className="duplicate-label"><strong>Copy of another file in the same upload — skipped:</strong></p>
                                <p className="duplicate-filenames">{duplicateNotice.batchCopies.join(', ')}</p>
                            </div>
                        )}
                        {duplicateNotice.filenames.length > 0 && (
                            <div className="duplicate-section">
                                <p className="duplicate-label"><strong>Already uploaded with the same filename — no new data:</strong></p>
                                <p className="duplicate-filenames">{duplicateNotice.filenames.join(', ')}</p>
                            </div>
                        )}
                        {duplicateNotice.contents.length > 0 && (
                            <div className="duplicate-section">
                                <p className="duplicate-label"><strong>Identical contents to a previously uploaded file:</strong></p>
                                <p className="duplicate-filenames">{duplicateNotice.contents.join(', ')}</p>
                            </div>
                        )}
                        <button className="modal-option" onClick={onDismissDuplicateNotice}>
                            <span className="modal-option-text">OK</span>
                        </button>
                    </div>
                </div>
            )}
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
                <button className="btn btn-secondary" onClick={() => navigate('/charts')} disabled={categorising}>
                    Go to Charts
                </button>
            )}

            <button className="btn btn-secondary" onClick={() => navigate('/contents')} disabled={categorising}>
                Go to Transactions
            </button>

            <button className="logout-btn" onClick={handleLogout}>
                Log Out
            </button>
        </>
    );
}