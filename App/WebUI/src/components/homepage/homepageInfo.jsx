import { useState, useRef, useEffect } from 'react';
import UploadFilesPopup from './UploadFilesPopup';
import '../../styles/homePage.css';
import { APP_TITLE } from '../../appTitle';

export default function HomepageInfo({ dateRangeInfo, uploadBreakdown, showTitle = true }) {
    // Single shared value - null means neither open, otherwise holds
    // WHICH one is open ('session' | 'past'). Opening one always sets
    // this to itself, which automatically closes the other, since
    // only one popup's isOpen can ever be true at a time.
    const [openPopup, setOpenPopup] = useState(null);
    const titleRef = useRef(null);

    useEffect(() => {
        const el = titleRef.current;
        if (!el) return;
        const fit = () => {
            el.style.fontSize = '';
            const base = parseFloat(getComputedStyle(el).fontSize);
            let size = base;
            while (el.scrollWidth > el.offsetWidth && size > 10) {
                size -= 0.5;
                el.style.fontSize = `${size}px`;
            }
        };
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    return (
        <>
            {showTitle && <h1 className="title" ref={titleRef}>{APP_TITLE}</h1>}

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