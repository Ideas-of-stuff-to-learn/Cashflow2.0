// config/breakpoints.js

// Below this width, the app uses the old app-style separate screens
// (Home/Charts/Contents, one at a time) instead of the combined
// Dashboard layout - the three-column dashboard (left action box,
// charts, right filter pane) doesn't have room to breathe below this.
// Adjust after eyeballing it live on real devices/browser resize -
// this is a single source of truth, not hardcoded in multiple places.
export const MOBILE_BREAKPOINT_PX = 1024;