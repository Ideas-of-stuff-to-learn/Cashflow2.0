// customHooks/charts/useModalSegmentPopup.js
import { useState, useCallback } from 'react';

// Popup state + rules for Variant 1 (modal-style overlay, blocks other
// bars while open). Different shape entirely from useSegmentPopup
// (Variants 2/3):
// - Showing a segment popup makes every OTHER bar inert (not
//   hoverable, not clickable) until dismissed
// - Dismiss ONLY by leaving the POPUP's own box (hover) or clicking
//   outside the popup's box - the chart/bars themselves are irrelevant
//   to dismissal here, unlike Variants 2/3 where the CHART boundary
//   is what matters instead.
export function useModalSegmentPopup() {
    const [activeSegment, setActiveSegment] = useState(null);

    // Same "hover, click, and tap all call this" idea as the other
    // hook - showing/updating the popup works identically here, only
    // the DISMISS rules differ between the two hooks.
    const showSegment = useCallback((segmentInfo) => {
        setActiveSegment(segmentInfo);
    }, []);

    // Called when the cursor leaves the POPUP itself (not the chart,
    // not a bar) - the hover-based dismiss for THIS variant.
    const handlePopupMouseLeave = useCallback(() => {
        setActiveSegment(null);
    }, []);

    // Called on a click landing outside the popup's own box.
    const handleClickOutsidePopup = useCallback(() => {
        setActiveSegment(null);
    }, []);

    // Whether bars OTHER than the currently-active one should be
    // inert right now - true whenever a popup is open at all, per
    // "other bars aren't clickable or hoverable till you [dismiss]".
    // Components rendering the bars read this to decide whether to
    // disable their own hover/click handlers.
    const otherBarsInert = activeSegment !== null;

    return {
        activeSegment,
        showSegment,
        handlePopupMouseLeave,
        handleClickOutsidePopup,
        otherBarsInert,
    };
}