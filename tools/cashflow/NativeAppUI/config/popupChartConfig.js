// Mirrors App/WebUI/src/config/popupChartConfig.jsx - same four popup
// placements, kept in sync so both platforms agree on which one is
// "current". RN has no hover at all (touch only), so there's no
// INTERACTION_MODE switch here - every touch behaves like the web
// build's CLICK mode by nature of being a touchscreen.

export const POPUP_STATES = {
    NONE: 'none',
    FLOATING_IN_CHART: 'floatingInChart',
    MODAL_IN_CHART: 'modalInChart',
    BELOW_CHART: 'belowChart',
};

export const POPUP_VARIANT = POPUP_STATES.FLOATING_IN_CHART;
