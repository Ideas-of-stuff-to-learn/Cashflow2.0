const MONTH_LABELS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MIN_HEIGHT_FRACTION = 0.03;

function withMinHeight(realValue, minRenderHeight) {
    return realValue > 0 ? Math.max(realValue, minRenderHeight) : 0;
}

export function buildYearStackData(yearly, categoryNames, categoryColors, selectedCategories, onSegmentPress, stackOrder) {
    const years = [...new Set(yearly.map(r => r.year))].sort((a, b) => a - b);

    const totalsByYear = {};
    let maxValue = 0;
    for (const row of yearly) {
        if (!totalsByYear[row.year]) totalsByYear[row.year] = {};
        totalsByYear[row.year][row.category] = row.total;
        if (row.total > maxValue) maxValue = row.total;
    }
    const minRenderHeight = maxValue * MIN_HEIGHT_FRACTION;

    const orderedCategories = stackOrder
        ? stackOrder.filter(c => c !== 'Income')
        : categoryNames.filter(category => category !== 'Income');

    return years.map(year => {
        const categoryTotals = totalsByYear[year] || {};
        let trueTotal = 0;
        const stacks = orderedCategories.map(category => {
            const realValue = categoryTotals[category] || 0;
            trueTotal += realValue;
            const visible = selectedCategories.has(category);
            return {
                value: visible ? withMinHeight(realValue, minRenderHeight) : 0,
                color: categoryColors[category] || '#BBBBBB',
                category,
                onPress: () => onSegmentPress({ year, category, value: realValue }),
            };
        });
        return { label: String(year), stacks, total: trueTotal };
    });
}

const DEFAULT_DRILLDOWN_TARGET = 12;

function groupMonthlyByYearMonth(monthly) {
    const map = new Map();
    for (const row of monthly) {
        const key = row.year * 100 + row.month;
        let entry = map.get(key);
        if (!entry) {
            entry = { year: row.year, month: row.month, categoryTotals: {} };
            map.set(key, entry);
        }
        entry.categoryTotals[row.category] = (entry.categoryTotals[row.category] || 0) + row.total;
    }
    return [...map.values()];
}

export function selectMonthsForDrilldown(monthly, year, targetCount = DEFAULT_DRILLDOWN_TARGET) {
    if (year == null) return [];

    const allEntries = groupMonthlyByYearMonth(monthly);

    const realMonths = allEntries
        .filter(e => e.year === year)
        .sort((a, b) => a.month - b.month);

    const needed = targetCount - realMonths.length;
    if (needed <= 0) return realMonths;

    const backfillPool = allEntries
        .filter(e => e.year < year)
        .sort((a, b) => (b.year - a.year) || (b.month - a.month));

    const backfill = backfillPool.slice(0, needed);

    return [...backfill, ...realMonths].sort((a, b) => (a.year - b.year) || (a.month - b.month));
}

export function selectMonthsForDrilldownAdjacentOnly(monthly, year, targetCount = DEFAULT_DRILLDOWN_TARGET) {
    if (year == null) return [];

    const allEntries = groupMonthlyByYearMonth(monthly);

    const realMonths = allEntries
        .filter(e => e.year === year)
        .sort((a, b) => a.month - b.month);

    const needed = targetCount - realMonths.length;
    if (needed <= 0) return realMonths;

    const adjacentYearPool = allEntries
        .filter(e => e.year === year - 1)
        .sort((a, b) => b.month - a.month);

    const backfill = adjacentYearPool.slice(0, needed);

    return [...backfill, ...realMonths].sort((a, b) => (a.year - b.year) || (a.month - b.month));
}

export function buildMonthStackDataFromEntries(entries, categoryNames, categoryColors, selectedCategories, onSegmentPress, stackOrder) {
    if (entries.length === 0) return [];

    const spansMultipleYears = new Set(entries.map(e => e.year)).size > 1;

    let maxValue = 0;
    for (const { categoryTotals } of entries) {
        for (const value of Object.values(categoryTotals)) {
            if (value > maxValue) maxValue = value;
        }
    }
    const minRenderHeight = maxValue * MIN_HEIGHT_FRACTION;

    const orderedCategories = stackOrder
        ? stackOrder.filter(c => c !== 'Income')
        : categoryNames.filter(category => category !== 'Income');

    return entries.map(({ year, month, categoryTotals }) => {
        let trueTotal = 0;
        const stacks = orderedCategories.map(category => {
            const realValue = categoryTotals[category] || 0;
            trueTotal += realValue;
            const visible = selectedCategories.has(category);
            return {
                value: visible ? withMinHeight(realValue, minRenderHeight) : 0,
                color: categoryColors[category] || '#BBBBBB',
                category,
                onPress: () => onSegmentPress({ year, month, category, value: realValue }),
            };
        });
        const monthName = MONTH_LABELS[month - 1] || String(month);
        const label = spansMultipleYears ? `${monthName} '${String(year).slice(2)}` : monthName;
        return { label, stacks, total: trueTotal };
    });
}

export function buildMonthStackData(monthly, year, categoryNames, categoryColors, selectedCategories, onSegmentPress, targetCount = DEFAULT_DRILLDOWN_TARGET) {
    const entries = selectMonthsForDrilldown(monthly, year, targetCount);
    return buildMonthStackDataFromEntries(entries, categoryNames, categoryColors, selectedCategories, onSegmentPress);
}

export function monthLabel(monthNumber) {
    return MONTH_LABELS[monthNumber - 1] || String(monthNumber);
}
