// components/charts/SegmentPopupFloating.jsx
import SegmentPopupContent from './SegmentPopupContent';
import '../../styles/segmentPopup.css';

// Anchors to the cursor's actual position at the moment of hover/click
// (segment._cursorPos, {x, y} relative to the chart container) rather
// than a fixed bar-top-center point. If there isn't enough room above
// the cursor for the bubble (near the top of the chart), it flips to
// render BELOW the cursor instead, with the arrow pointing up instead
// of down.
//
// FLIP_THRESHOLD_PX: if the cursor's y-position (measured from the
// TOP of the chart, per how cursorY is computed in fire()) is less
// than this, there's not enough headroom above it - flip below instead.
const FLIP_THRESHOLD_PX = 70;

export default function SegmentPopupFloating({ segment }) {
    if (!segment || !segment._cursorPos) return null;

    const { x, y } = segment._cursorPos;
    const shouldFlip = y < FLIP_THRESHOLD_PX;

    return (
        <div
            className={`segment-popup-floating ${shouldFlip ? 'segment-popup-floating-below' : ''}`}
            style={{ left: x, top: y }}
        >
            {shouldFlip && <div className="segment-popup-floating-arrow segment-popup-floating-arrow-up" />}
            <SegmentPopupContent segment={segment} />
            {!shouldFlip && <div className="segment-popup-floating-arrow" />}
        </div>
    );
}