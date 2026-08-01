// components/charts/SegmentPopupModal.jsx
import SegmentPopupContent from './SegmentPopupContent';
import '../../styles/segmentPopup.css';

export default function SegmentPopupModal({ segment, onMouseLeave, onClickOutside }) {
    if (!segment) return null;

    return (
        // FIX - the backdrop's own onClick now actually calls
        // onClickOutside when the click lands on the backdrop itself
        // (not bubbled up from inside the popup box) - this was
        // previously never wired to anything at all.
        <div
            className="segment-popup-modal-backdrop"
            onClick={(e) => {
                if (e.target === e.currentTarget && onClickOutside) onClickOutside();
            }}
        >
            <div className="segment-popup-modal" onMouseLeave={onMouseLeave}>
                <SegmentPopupContent segment={segment} />
            </div>
        </div>
    );
}