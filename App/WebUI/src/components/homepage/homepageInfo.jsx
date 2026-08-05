import UploadFilesPopup from './UploadFilesPopup';
import '../../styles/homePage.css';

export default function HomepageInfo({ dateRangeInfo, uploadBreakdown }) {
    return (
        <>
            <h1 className="title">Spending Pattern Visualisation Tool</h1>

            <div className="range-text">
                <UploadFilesPopup
                    label="Files uploaded this session"
                    files={uploadBreakdown.session_files}
                    count={uploadBreakdown.session_count}
                />
            </div>
            <div className="range-text">
                <UploadFilesPopup
                    label="Past files uploaded"
                    files={uploadBreakdown.past_files}
                    count={uploadBreakdown.past_count}
                />
            </div>

            {dateRangeInfo && (
                <p className="range-text">
                    You've uploaded transactions from {dateRangeInfo.rangeText} so far
                    {dateRangeInfo.skippedMonthYears.length > 0
                        ? ` (skipped ${dateRangeInfo.skippedMonthYears.join(', ')})`
                        : ''}.
                </p>
            )}
        </>
    );
}