// utils/charts/chartWindowConfig.js
//
// The single source of truth for "how many months/years does one
// window show at a time" - was hardcoded as the literal number 12
// (and its -11/+11 derivatives, since a window's LAST slot is 11
// steps after its first) across monthWindow.js, yearWindow.js,
// useChartWindows.jsx, and RangeWindowSlider.jsx. Change WINDOW_SIZE
// here to adjust it everywhere at once.
export const WINDOW_SIZE = 9;

// Derived, not independently set - the offset from a window's first
// slot to its last. Always WINDOW_SIZE - 1, wherever the old code had
// a literal 11.
export const WINDOW_SIZE_OFFSET = WINDOW_SIZE - 1;