const MONTH_LABELS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Segments with genuinely zero spend (a category with no transactions
// that year/month) render with 0 height in a stacked bar - and a
// zero-height element has no tappable area at all on mobile, which is
// why some categories seemed randomly untappable depending on the
// month. This gives every VISIBLE, NONZERO segment a small minimum
// height so there's always something to tap, scaled to 3% of the
// largest value in the current dataset (a flat pixel/currency minimum
// wouldn't work consistently - 3% of a max of 50 and 3% of a max of
// 5000 need to be very different absolute sizes to both look right).
// Genuine zeros stay exactly 0 - they get filtered out of the chart
// entirely rather than shown as a padded sliver, since a category with
// truly no spend that period shouldn't appear at all. The reported
// value in onPress is always the TRUE amount - only the rendered
// height gets padded, never what gets displayed.
const MIN_HEIGHT_FRACTION = 0.03;

function withMinHeight(realValue, minRenderHeight) {
    return realValue > 0 ? Math.max(realValue, minRenderHeight) : 0;
}

// Builds one stacked bar per year from the flat `yearly` aggregate rows
// ({year, category, total}). Segments for categories not in
// selectedCategories are zeroed out rather than removed, matching the
// existing app-wide convention (empty Set = show everything).
export function buildYearStackData(yearly, categoryNames, categoryColors, selectedCategories, onSegmentPress) {
    const years = [...new Set(yearly.map(r => r.year))].sort((a, b) => a - b);

    const totalsByYear = {};
    let maxValue = 0;
    for (const row of yearly) {
        if (!totalsByYear[row.year]) totalsByYear[row.year] = {};
        totalsByYear[row.year][row.category] = row.total;
        if (row.total > maxValue) maxValue = row.total;
    }
    const minRenderHeight = maxValue * MIN_HEIGHT_FRACTION;

    return years.map(year => {
        const categoryTotals = totalsByYear[year] || {};
        const stacks = categoryNames
            .filter(category => category !== 'Income')
            .map(category => {
                const realValue = categoryTotals[category] || 0;
                const visible = selectedCategories.size === 0 || selectedCategories.has(category);
                return {
                    value: visible ? withMinHeight(realValue, minRenderHeight) : 0,
                    color: categoryColors[category] || '#BBBBBB',
                    category,
                    onPress: () => onSegmentPress({ year, category, value: realValue }),
                };
            });
        return { label: String(year), stacks };
    });
}

// Same idea, one level down - builds one stacked bar per month, scoped
// to a single already-selected year.
export function buildMonthStackData(monthly, year, categoryNames, categoryColors, selectedCategories, onSegmentPress) {
    if (year == null) return [];

    const monthsInYear = monthly.filter(r => r.year === year);
    const totalsByMonth = {};
    let maxValue = 0;
    for (const row of monthsInYear) {
        if (!totalsByMonth[row.month]) totalsByMonth[row.month] = {};
        totalsByMonth[row.month][row.category] = row.total;
        if (row.total > maxValue) maxValue = row.total;
    }
    const minRenderHeight = maxValue * MIN_HEIGHT_FRACTION;

    const months = [...new Set(monthsInYear.map(r => r.month))].sort((a, b) => a - b);

    return months.map(month => {
        const categoryTotals = totalsByMonth[month] || {};
        const stacks = categoryNames
            .filter(category => category !== 'Income')
            .map(category => {
                const realValue = categoryTotals[category] || 0;
                const visible = selectedCategories.size === 0 || selectedCategories.has(category);
                return {
                    value: visible ? withMinHeight(realValue, minRenderHeight) : 0,
                    color: categoryColors[category] || '#BBBBBB',
                    category,
                    onPress: () => onSegmentPress({ year, month, category, value: realValue }),
                };
            });
        return { label: MONTH_LABELS[month - 1] || String(month), stacks };
    });
}

export function monthLabel(monthNumber) {
    return MONTH_LABELS[monthNumber - 1] || String(monthNumber);
}