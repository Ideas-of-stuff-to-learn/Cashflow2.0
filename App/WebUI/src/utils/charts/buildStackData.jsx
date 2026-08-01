// utils/charts/buildStackData.js
import { transformValue } from './chartUtils';

const MIN_RENDER_HEIGHT_FRACTION = 0.03; // 3% of maxValue, same floor the old build functions used

// Converts EITHER a year-window's or a month-window's entries (both
// share the same {year, month?, categoryTotals} shape from
// monthWindow.js/yearWindow.js) into the {label, stacks, total} shape
// SpendingStackChart actually renders. One function instead of two
// separate ones (the old buildYearStackData/buildMonthStackDataFromEntries)
// because the windows now produce identically-shaped input - there's
// no real difference left to justify two copies of this logic.
export function buildStackDataFromEntries(entries, {
    categoryNames, categoryColors, selectedCategories, stackOrder, onSegmentPress, spansMultipleYears = false,
}) {
    const orderedCategories = (stackOrder ? stackOrder.filter(c => c !== 'Income') : categoryNames.filter(c => c !== 'Income'));

    // maxValue needs to be known before computing minRenderHeight -
    // same two-pass approach the old functions used: first pass sums
    // real totals, second pass applies the tap-target floor.
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
                onPress: () => onSegmentPress({
                    year: entry.year,
                    month: entry.month, // undefined for year-window entries, harmless
                    category,
                    value: realValue,
                }),
            };
        });

        const label = entry.month
            ? (spansMultipleYears ? `${entry.label} '${String(entry.year).slice(2)}` : entry.label)
            : entry.label;

        return { label, stacks, total: trueTotal };
    });
}

// Same shape conversion for the income line - both windows' entries
// carry Income inside categoryTotals same as any other category, this
// just extracts it into the flat {value} array SpendingStackChart's
// incomeData prop expects.
export function buildIncomeDataFromEntries(entries) {
    return entries.map(entry => ({ value: entry.categoryTotals['Income'] || 0 }));
}