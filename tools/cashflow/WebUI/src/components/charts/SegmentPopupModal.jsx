// components/charts/SegmentPopupModal.jsx
import SegmentPopupContent from './SegmentPopupContent';
import '../../styles/segmentPopup.css';

// Dismiss now happens entirely via SpendingStackedChart's own
// chart-level rules (leave the chart / click empty chart space) - this
// component is purely visual now, no dismiss logic of its own left.
export default function SegmentPopupModal({ segment }) {
    if (!segment) return null;

    return (
        <div className="segment-popup-modal-backdrop">
            <div className="segment-popup-modal">
                <SegmentPopupContent segment={segment} />
            </div>
        </div>
    );
}