// utils/charts/monthWindow.js

export const MONTH_LABELS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
export const MONTH_LABELS_FULL = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];
// Advances (year, month) forward or backward by `delta` calendar
// months, wrapping year boundaries correctly. delta can be negative
// (go backward) or positive (go forward).
export function addMonths(year, month, delta) {
    const zeroBasedTotal = (year * 12 + (month - 1)) + delta;
    const newYear = Math.floor(zeroBasedTotal / 12);
    const newMonth = (zeroBasedTotal % 12 + 12) % 12 + 1;
    return { year: newYear, month: newMonth };
}

// Builds a lookup from `monthly` ({year, month, category, total} rows)
// into one entry per (year, month), each carrying its category->total
// map. Same grouping `groupMonthlyByYearMonth` in yearlyChartUtils.jsx
// already does - reused here rather than duplicated logic, just given
// its own name in this new file since this is the real foundation the
// windowing logic builds on.
export function groupMonthlyByKey(monthly) {
    const map = new Map();
    for (const row of monthly) {
        const key = `${row.year}-${row.month}`;
        let entry = map.get(key);
        if (!entry) {
            entry = { year: row.year, month: row.month, categoryTotals: {} };
            map.set(key, entry);
        }
        entry.categoryTotals[row.category] = (entry.categoryTotals[row.category] || 0) + row.total;
    }
    return map;
}

// The core windowing function. Returns EXACTLY 12 consecutive calendar
// months starting at (startYear, startMonth) - real gaps included as
// genuinely empty entries (categoryTotals: {}), never skipped, never
// backfilled from elsewhere. This is deliberately different from the
// old selectMonthsForDrilldown/AdjacentOnly functions (yearlyChartUtils.jsx),
// which pick real data points and skip empty months entirely - this
// function instead guarantees a true, gapless calendar timeline, which
// is what a genuinely scrollable window needs: the 12 slots always
// mean the same 12 real months, whether or not data exists for them.
export function getMonthWindow(monthly, startYear, startMonth) {
    const byKey = groupMonthlyByKey(monthly);
    const months = [];

    for (let i = 0; i < 12; i++) {
        const { year, month } = addMonths(startYear, startMonth, i);
        const key = `${year}-${month}`;
        const entry = byKey.get(key);
        months.push({
            year,
            month,
            label: MONTH_LABELS[month - 1],
            categoryTotals: entry ? entry.categoryTotals : {},
        });
    }

    return months;
}

// Finds the (year, month) to start a window at, so the window's LAST
// slot lands on the most recent real month present in the data - used
// for the default "most recent 12 months" starting state. Falls back
// to the current real-world month if there's no data at all yet.
export function getDefaultMonthWindowStart(monthly) {
    if (!monthly || monthly.length === 0) {
        const now = new Date();
        return addMonths(now.getFullYear(), now.getMonth() + 1, -11);
    }
    const latest = monthly.reduce((max, row) => {
        const key = row.year * 100 + row.month;
        return key > max.key ? { key, year: row.year, month: row.month } : max;
    }, { key: -Infinity, year: 0, month: 0 });

    return addMonths(latest.year, latest.month, -11);
}

// Returns the earliest and latest (year, month) actually present in
// the data - used to clamp scrolling so you can't scroll past real
// history in either direction.
export function getMonthDataBounds(monthly) {
    if (!monthly || monthly.length === 0) return null;
    let earliest = null, latest = null;
    for (const row of monthly) {
        const key = row.year * 100 + row.month;
        if (!earliest || key < earliest.key) earliest = { key, year: row.year, month: row.month };
        if (!latest || key > latest.key) latest = { key, year: row.year, month: row.month };
    }
    return { earliest, latest };
}