// customHooks/charts/useSegmentPopup.js
import { useState, useCallback } from 'react';

// Shared popup state + dismiss rules for Variant 2 (fixed-position)
// and Variant 3 (floating-near-bar) - both use IDENTICAL interaction
// rules, only their visual placement differs. Variant 1 (modal
// overlay) has different rules entirely and uses its own separate
// hook, useModalSegmentPopup.js.
//
// Rules implemented here:
// - Hovering OR clicking a segment shows/updates the popup (desktop)
// - Tapping a segment shows/updates the popup (phone - same handler)
// - Hovering/clicking a DIFFERENT segment just updates the content,
//   no need to dismiss first
// - Moving the cursor entirely outside the chart area dismisses it
// - Hovering empty chart space (not a bar) does NOT dismiss it
// - Clicking empty chart space (not a bar) DOES dismiss it
export function useSegmentPopup() {
    const [activeSegment, setActiveSegment] = useState(null);

    // The single function hover, click, AND tap all call - your spec
    // has all three inputs doing the exact same "show/update" action,
    // so there's no need for separate handlers per input type.
    const showSegment = useCallback((segmentInfo) => {
        setActiveSegment(segmentInfo);
    }, []);

    // Called when the cursor leaves the WHOLE chart container (not
    // just one bar) - the only hover-based dismiss trigger for this
    // variant pair.
    const handleChartMouseLeave = useCallback(() => {
        setActiveSegment(null);
    }, []);

    // Called when clicking anywhere inside the chart that ISN'T a bar
    // segment itself - manual dismiss for "clicked empty space on
    // desktop" and "tapped empty space on phone" (phone has no hover
    // dismiss at all, so this is its ONLY dismiss path here).
    const handleChartBackgroundClick = useCallback(() => {
        setActiveSegment(null);
    }, []);

    return {
        activeSegment,
        showSegment,
        handleChartMouseLeave,
        handleChartBackgroundClick,
    };
}