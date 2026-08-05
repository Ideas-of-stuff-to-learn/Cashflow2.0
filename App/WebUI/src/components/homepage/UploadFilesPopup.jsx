import { useState } from 'react';
import '../../styles/uploadFilesPopup.css';

// Modal-style hover/click popup showing a scrollable list of actual
// filenames behind a count - same interaction model as the chart's
// SegmentPopupModal: dismiss by hovering/clicking outside the popup
// box itself, everything else stays inert while it's open.
export default function UploadFilesPopup({ label, files, count }) {
    const [open, setOpen] = useState(false);

    return (
        <span className="upload-files-trigger-wrap">
            <span
                className="upload-files-trigger"
                onMouseEnter={() => setOpen(true)}
                onClick={() => setOpen(true)}
            >
                {label}: {count}
            </span>

            {open && (
                <div className="upload-files-popup-backdrop" onClick={() => setOpen(false)}>
                    <div
                        className="upload-files-popup-box"
                        onMouseLeave={() => setOpen(false)}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {files.length === 0 ? (
                            <p className="upload-files-popup-empty">No files here yet.</p>
                        ) : (
                            <ul className="upload-files-popup-list">
                                {files.map((f, i) => (
                                    <li key={i} className="upload-files-popup-item">
                                        {f.filename}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </span>
    );
}