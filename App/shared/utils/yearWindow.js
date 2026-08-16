import { WINDOW_SIZE, WINDOW_SIZE_OFFSET } from './chartWindowConfig.js';

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
        years.push({ year, label: String(year), categoryTotals: entry ? entry.categoryTotals : {} });
    }
    return years;
}

export function getDefaultYearWindowStart(yearly) {
    if (!yearly || yearly.length === 0) return new Date().getFullYear() - WINDOW_SIZE_OFFSET;
    const latestYear = yearly.reduce((max, row) => Math.max(max, row.year), -Infinity);
    return latestYear - WINDOW_SIZE_OFFSET;
}

export function syncYearWindowToMonthWindow(currentYearWindowStart, monthWindowEntries) {
    if (!monthWindowEntries || monthWindowEntries.length === 0) return currentYearWindowStart;
    const yearsInView = new Set(monthWindowEntries.map(m => m.year));
    const minYearNeeded = Math.min(...yearsInView);
    const maxYearNeeded = Math.max(...yearsInView);
    const currentWindowEnd = currentYearWindowStart + WINDOW_SIZE_OFFSET;
    if (minYearNeeded >= currentYearWindowStart && maxYearNeeded <= currentWindowEnd) return currentYearWindowStart;
    if (minYearNeeded < currentYearWindowStart) return minYearNeeded;
    return maxYearNeeded - WINDOW_SIZE_OFFSET;
}

export function getYearDataBounds(yearly) {
    if (!yearly || yearly.length === 0) return null;
    const years = yearly.map(r => r.year);
    return { earliestYear: Math.min(...years), latestYear: Math.max(...years) };
}
