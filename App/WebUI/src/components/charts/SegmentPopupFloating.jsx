// components/charts/SegmentPopupFloating.jsx
import SegmentPopupContent from './SegmentPopupContent';
import '../../styles/segmentPopup.css';

// Variant 3 - floats just above whichever bar is currently active.
// `position` ({left, top}) is computed by the caller (SpendingStackedChart,
// which already knows each bar's real on-screen coordinates), this
// component just renders at whatever position it's given.
export default function SegmentPopupFloating({ segment, position }) {
    if (!segment || !position) return null;

    return (
        <div
            className="segment-popup-floating"
            style={{ left: position.left, top: position.top }}
        >
            <SegmentPopupContent segment={segment} />
            <div className="segment-popup-floating-arrow" />
        </div>
    );
}