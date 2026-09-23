import { useRef, useEffect } from 'react';
import '../../styles/uploadFilesPopup.css';

// isOpen/onOpen/onClose are now controlled by the PARENT (HomepageInfo),
// not local state here - this is what lets the parent enforce "only
// one popup open at a time" by owning a single shared value instead of
// each instance tracking its own independent boolean.
export default function UploadFilesPopup({ label, files, count, isOpen, onOpen, onClose }) {
    const wrapRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;

        function handleDocumentClick(e) {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) {
                onClose();
            }
        }

        document.addEventListener('mousedown', handleDocumentClick);
        return () => document.removeEventListener('mousedown', handleDocumentClick);
    }, [isOpen, onClose]);

    return (
        <span className="upload-files-trigger-wrap" ref={wrapRef}>
            <span
                className="upload-files-trigger"
                onMouseEnter={onOpen}
                onClick={onOpen}
            >
                {label}: {count}
            </span>

            {isOpen && (
                <div className="upload-files-popup-box" onMouseLeave={onClose}>
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
            )}
        </span>
    );
}