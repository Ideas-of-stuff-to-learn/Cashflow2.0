// utils/charts/yearWindow.js
import { groupMonthlyByKey } from './monthWindow';
import { WINDOW_SIZE, WINDOW_SIZE_OFFSET } from './chartWindowConfig';

// Same idea as getMonthWindow, one level up: given a starting year,
// returns 12 consecutive calendar YEARS, gaps included as genuinely
// empty (no data that year) rather than skipped.
export function getYearWindow(yearly, startYear) {
    const byYear = new Map();
    for (const row of yearly) {
        let entry = byYear.get(row.year);
        if (!entry) {
            entry = { year: row.year, categoryTotals: {} };
            byYear.set(row.year, entry);
        }
        entry.categoryTotals[row.category] = (entry.categoryTotals[row.category] || 0) + row.total;
    }

    const years = [];
    for (let i = 0; i < WINDOW_SIZE; i++) {
        const year = startYear + i;
        const entry = byYear.get(year);
        years.push({
            year,
            label: String(year),
            categoryTotals: entry ? entry.categoryTotals : {},
        });
    }
    return years;
}

// Same "most recent 12" starting logic as getDefaultMonthWindowStart,
// at year granularity. Falls back to the real current year if there's
// no data at all yet.
export function getDefaultYearWindowStart(yearly) {
    if (!yearly || yearly.length === 0) {
        return new Date().getFullYear() - WINDOW_SIZE_OFFSET;
    }
    const latestYear = yearly.reduce((max, row) => Math.max(max, row.year), -Infinity);
    return latestYear - WINDOW_SIZE_OFFSET;
}

// The one-way follower: given the year window's CURRENT start, and the
// list of 12 month entries currently shown in the month window,
// figures out whether the year window still "covers" wherever the
// month window is sitting - and if not, shifts it by the MINIMUM
// amount needed to include those years. Never touches the month
// window itself; this only ever returns a possibly-adjusted year
// window start for the caller to apply.
//
// Deliberately minimal-shift, not "recenter" - if the current year
// window already covers the month window's years, it's left
// completely untouched, so a person's own manual year-window scroll
// isn't casually overridden just because the month window nudged by
// one month and still falls well within the same visible range.
export function syncYearWindowToMonthWindow(currentYearWindowStart, monthWindowEntries) {
    if (!monthWindowEntries || monthWindowEntries.length === 0) {
        return currentYearWindowStart;
    }

    const yearsInView = new Set(monthWindowEntries.map(m => m.year));
    const minYearNeeded = Math.min(...yearsInView);
    const maxYearNeeded = Math.max(...yearsInView);

    const currentWindowEnd = currentYearWindowStart + WINDOW_SIZE_OFFSET;

    if (minYearNeeded >= currentYearWindowStart && maxYearNeeded <= currentWindowEnd) {
        // Already fully covered - no change needed.
        return currentYearWindowStart;
    }

    if (minYearNeeded < currentYearWindowStart) {
        // Month window scrolled backward past the year window's start -
        // shift the year window back just enough to include it.
        return minYearNeeded;
    }

    // Month window scrolled forward past the year window's end -
    // shift forward just enough that maxYearNeeded becomes the new
    // last slot (i.e. start = maxYearNeeded - WINDOW_SIZE_OFFSET).
    return maxYearNeeded - WINDOW_SIZE_OFFSET;
}

export function getYearDataBounds(yearly) {
    if (!yearly || yearly.length === 0) return null;
    const years = yearly.map(r => r.year);
    return { earliestYear: Math.min(...years), latestYear: Math.max(...years) };
}