// components/charts/SegmentPopupModal.jsx
import SegmentPopupContent from './SegmentPopupContent';
import '../../styles/segmentPopup.css';

// Variant 1 - overlays on top of the chart at a high z-index. Its own
// onMouseLeave/onClick-outside are wired by the PARENT (whatever
// renders this), via handlePopupMouseLeave/handleClickOutsidePopup
// from useModalSegmentPopup - this component just needs to expose the
// right DOM hooks for those to attach to.
export default function SegmentPopupModal({ segment, onMouseLeave }) {
    if (!segment) return null;

    return (
        <div className="segment-popup-modal-backdrop">
            <div className="segment-popup-modal" onMouseLeave={onMouseLeave}>
                <SegmentPopupContent segment={segment} />
            </div>
        </div>
    );
}