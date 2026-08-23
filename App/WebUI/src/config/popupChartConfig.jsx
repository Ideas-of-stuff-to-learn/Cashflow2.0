// Where the tapped/hovered chart segment's detail popup renders, and
// how a person triggers/dismisses it. Both apply to every screen that
// uses ChartWindowSection (Dashboard's laptop layout AND the phone-mimic
// ChartsScreen) - there's only one shared switch for each, not one per
// screen.

export const POPUP_STATES = {
    NONE: 'none',                       // no popup at all - tapping a segment does nothing
    FLOATING_IN_CHART: 'floatingInChart', // small bubble anchored to the cursor/tap position, inside the chart
    MODAL_IN_CHART: 'modalInChart',       // full overlay centered on top of the chart
    BELOW_CHART: 'belowChart',            // fixed spot under the chart, where the old tapped-value text used to sit
};

// Which of the four states above is currently active.
export const POPUP_VARIANT = POPUP_STATES.FLOATING_IN_CHART;

export const INTERACTION_MODES = {
    HOVER: 'hover', // desktop mouse: hovering a segment shows/updates the popup, moving off the chart dismisses it
    CLICK: 'click', // touch / explicit click: only clicking a segment shows it, only clicking outside the popup dismisses it
};

// The phone-mimic view has no hover at all, so it always needs CLICK -
// but this same switch also controls the laptop/Dashboard view, since
// both render through the same ChartWindowSection / StackBar / popup
// components.
export const INTERACTION_MODE = INTERACTION_MODES.HOVER;
