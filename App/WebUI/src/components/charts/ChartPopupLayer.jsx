// components/charts/ChartPopupLayer.jsx
import SegmentPopupFixed from './SegmentPopupFixed';
import SegmentPopupFloating from './SegmentPopupFloating';
import SegmentPopupModal from './SegmentPopupModal';

// Decides WHICH popup variant actually renders, based on popupVariant.
// Extracted out of SpendingStackedChart.jsx - that file no longer
// needs to know the three variants exist at all, it just renders this
// one component and lets IT sort out which visual to show.
//
// Note: SegmentPopupFixed renders in a completely different LOCATION
// in the tree (below the whole chart, outside the scroll container -
// see ChartWindowSection.jsx) - so it's deliberately NOT rendered here
// alongside the other two. This component only handles the two
// variants that render INSIDE the chart's own coordinate space
// (floating, anchored to a segment) or as an overlay ON TOP of it
// (modal).
export default function ChartPopupLayer({ popupVariant, activeSegment }) {
    if (popupVariant === 'floating' && activeSegment) {
        return <SegmentPopupFloating segment={activeSegment} />;
    }

    if (popupVariant === 'modal') {
        return <SegmentPopupModal segment={activeSegment} />;
    }

    return null;
}