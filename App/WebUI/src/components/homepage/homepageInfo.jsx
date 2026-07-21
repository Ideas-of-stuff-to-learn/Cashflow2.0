import '../../styles/homePage.css';

export default function HomepageInfo({ dateRangeInfo, uploadCount }) {
    return (
        <>
            <h1 className="title">Transaction Categorizer</h1>
            <p className="important-msg">This app does NOT connect to banks, it is strictly CSV upload only</p>
            <p className="subtitle">Upload a CSV to get started</p>
            <p className="range-text">
                Number of past files uploaded : {uploadCount}
            </p>
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