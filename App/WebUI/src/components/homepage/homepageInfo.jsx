import '../../styles/homePage.css';

export default function HomepageInfo({ dateRangeInfo, uploadCount }) {
    return (
        <>
            <h1 className="title">Spending Pattern Visualisation Tool</h1>
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