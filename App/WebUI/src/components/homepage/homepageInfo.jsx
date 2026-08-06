import { useState } from 'react';
import UploadFilesPopup from './UploadFilesPopup';
import '../../styles/homePage.css';

export default function HomepageInfo({ dateRangeInfo, uploadBreakdown }) {
    // Single shared value - null means neither open, otherwise holds
    // WHICH one is open ('session' | 'past'). Opening one always sets
    // this to itself, which automatically closes the other, since
    // only one popup's isOpen can ever be true at a time.
    const [openPopup, setOpenPopup] = useState(null);

    return (
        <>
            <h1 className="title">Spending Pattern Visualisation Tool</h1>


            <div className="range-text">
                <UploadFilesPopup
                    label="Past files uploaded"
                    files={uploadBreakdown.past_files}
                    count={uploadBreakdown.past_count}
                    isOpen={openPopup === 'past'}
                    onOpen={() => setOpenPopup('past')}
                    onClose={() => setOpenPopup(null)}
                />
            </div>
            
            <div className="range-text">
                <UploadFilesPopup
                    label="Files uploaded this session"
                    files={uploadBreakdown.session_files}
                    count={uploadBreakdown.session_count}
                    isOpen={openPopup === 'session'}
                    onOpen={() => setOpenPopup('session')}
                    onClose={() => setOpenPopup(null)}
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