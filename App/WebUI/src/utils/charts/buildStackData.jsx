// utils/charts/buildStackData.js
import { transformValue } from './chartUtils';

const MIN_RENDER_HEIGHT_FRACTION = 0.03; // 3% of maxValue, same floor the old build functions used

// Converts EITHER a year-window's or a month-window's entries into the
// {label, stacks, total} shape SpendingStackChart actually renders.
//
// extraOnPress: an OPTIONAL second callback, fired alongside the
// normal onSegmentPress whenever a segment is clicked. Used specifically
// for year-mode clicks - when clicking a year bar, we want BOTH the
// usual "show the tapped value below the chart" behaviour (that's
// onSegmentPress, from useChartData) AND "jump the month window to
// this year" (that's extraOnPress, wired in by ChartWindowSection).
// Pass null/undefined when there's nothing extra to do (e.g. in month
// mode, where clicking a segment should only ever do the normal thing).
export function buildStackDataFromEntries(entries, extraOnPress, {
    categoryNames, categoryColors, selectedCategories, stackOrder, onSegmentPress, spansMultipleYears = false,
} = {}) {
    const orderedCategories = (stackOrder ? stackOrder.filter(c => c !== 'Income') : categoryNames.filter(c => c !== 'Income'));

    const rawTotals = entries.map(entry =>
        orderedCategories.reduce((sum, cat) => sum + (entry.categoryTotals[cat] || 0), 0)
    );
    const maxValue = Math.max(1, ...rawTotals);
    const minRenderHeight = maxValue * MIN_RENDER_HEIGHT_FRACTION;

    function withMinHeight(realValue) {
        return realValue > 0 ? Math.max(realValue, minRenderHeight) : 0;
    }

    return entries.map(entry => {
        let trueTotal = 0;
        const stacks = orderedCategories.map(category => {
            const realValue = entry.categoryTotals[category] || 0;
            trueTotal += realValue;
            const visible = selectedCategories.size === 0 || selectedCategories.has(category);
            return {
                value: visible ? withMinHeight(realValue) : 0,
                color: categoryColors[category] || '#BBBBBB',
                category,
                onPress: () => {
                    onSegmentPress({ year: entry.year, month: entry.month, category, value: realValue });
                    if (extraOnPress) extraOnPress(entry.year);
                },
            };
        });

        const label = entry.month
            ? (spansMultipleYears ? `${entry.label} '${String(entry.year).slice(2)}` : entry.label)
            : entry.label;

        return { label, stacks, total: trueTotal };
    });
}

export function buildIncomeDataFromEntries(entries) {
    return entries.map(entry => ({ value: entry.categoryTotals['Income'] || 0 }));
}