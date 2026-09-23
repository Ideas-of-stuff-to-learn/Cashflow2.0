// customHooks/charts/useSegmentPopup.js
import { useState, useCallback, useEffect } from 'react';
import { INTERACTION_MODE, INTERACTION_MODES } from '../../config/popupChartConfig';

// Shared popup state + dismiss rules for Variant 2 (fixed-position)
// and Variant 3 (floating-near-bar) - both use IDENTICAL interaction
// rules, only their visual placement differs. Variant 1 (modal
// overlay) has different rules entirely and uses its own separate
// hook, useModalSegmentPopup.js.
//
// Rules implemented here, per config/popupChartConfig's INTERACTION_MODE:
// HOVER mode (desktop mouse):
// - Hovering OR clicking a segment shows/updates the popup
// - Hovering/clicking a DIFFERENT segment just updates the content,
//   no need to dismiss first
// - Moving the cursor entirely outside the chart area dismisses it
// - Hovering empty chart space (not a bar) does NOT dismiss it
// - Clicking empty chart space (not a bar) DOES dismiss it
// CLICK mode (phone-mimic / no-hover):
// - Only clicking/tapping a segment shows/updates the popup
// - Clicking anywhere outside the popup itself (empty chart space,
//   or anywhere else on the page) dismisses it - there's no hover to
//   leave, so mouse-leave is not a dismiss trigger at all here
export function useSegmentPopup() {
    const [activeSegment, setActiveSegment] = useState(null);
    const isClickMode = INTERACTION_MODE === INTERACTION_MODES.CLICK;

    // The single function hover, click, AND tap all call - your spec
    // has all three inputs doing the exact same "show/update" action,
    // so there's no need for separate handlers per input type.
    const showSegment = useCallback((segmentInfo) => {
        setActiveSegment(segmentInfo);
    }, []);

    // Called when the cursor leaves the WHOLE chart container (not
    // just one bar) - only a dismiss trigger in HOVER mode. In CLICK
    // mode there's no hover, so this is a no-op.
    const handleChartMouseLeave = useCallback(() => {
        if (isClickMode) return;
        setActiveSegment(null);
    }, [isClickMode]);

    // Called when clicking anywhere inside the chart that ISN'T a bar
    // segment itself - manual dismiss for "clicked empty space".
    const handleChartBackgroundClick = useCallback(() => {
        setActiveSegment(null);
    }, []);

    // CLICK mode's other dismiss path: clicking anywhere OUTSIDE the
    // popup at all (not just empty chart space) closes it - covers
    // clicking elsewhere on the page entirely.
    useEffect(() => {
        if (!isClickMode || !activeSegment) return;

        function handleDocumentClick(e) {
            if (e.target.closest('.stack-chart-scroll, .segment-popup-floating, .segment-popup-modal, .segment-popup-fixed')) {
                return;
            }
            setActiveSegment(null);
        }

        document.addEventListener('mousedown', handleDocumentClick);
        return () => document.removeEventListener('mousedown', handleDocumentClick);
    }, [isClickMode, activeSegment]);

    return {
        activeSegment,
        showSegment,
        handleChartMouseLeave,
        handleChartBackgroundClick,
    };
}