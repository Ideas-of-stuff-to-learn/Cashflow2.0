// components/charts/SegmentPopupFixed.jsx
import SegmentPopupContent from './SegmentPopupContent';
import '../../styles/segmentPopup.css';

// Variant 2 - sits in a fixed spot below the chart, same location the
// old tapped-value text used to occupy. No positioning math needed -
// dismiss/update rules all live in useSegmentPopup, this component is
// purely visual.
export default function SegmentPopupFixed({ segment }) {
    if (!segment) return null;

    return (
        <div className="segment-popup-fixed">
            <SegmentPopupContent segment={segment} />
        </div>
    );
}