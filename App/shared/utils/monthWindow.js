import { WINDOW_SIZE, WINDOW_SIZE_OFFSET } from './chartWindowConfig.js';

export const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function addMonths(year, month, delta) {
    const zeroBasedTotal = (year * 12 + (month - 1)) + delta;
    const newYear = Math.floor(zeroBasedTotal / 12);
    const newMonth = (zeroBasedTotal % 12 + 12) % 12 + 1;
    return { year: newYear, month: newMonth };
}

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

export function getMonthWindow(monthly, startYear, startMonth) {
    const byKey = groupMonthlyByKey(monthly);
    const months = [];
    for (let i = 0; i < WINDOW_SIZE; i++) {
        const { year, month } = addMonths(startYear, startMonth, i);
        const key = `${year}-${month}`;
        const entry = byKey.get(key);
        months.push({ year, month, label: MONTH_LABELS[month - 1], categoryTotals: entry ? entry.categoryTotals : {} });
    }
    return months;
}

export function getDefaultMonthWindowStart(monthly) {
    if (!monthly || monthly.length === 0) {
        const now = new Date();
        return addMonths(now.getFullYear(), now.getMonth() + 1, -WINDOW_SIZE_OFFSET);
    }
    const latest = monthly.reduce((max, row) => {
        const key = row.year * 100 + row.month;
        return key > max.key ? { key, year: row.year, month: row.month } : max;
    }, { key: -Infinity, year: 0, month: 0 });
    return addMonths(latest.year, latest.month, -WINDOW_SIZE_OFFSET);
}

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
