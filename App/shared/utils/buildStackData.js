const MIN_RENDER_HEIGHT_FRACTION = 0.03;

export function buildStackDataFromEntries(entries, extraOnPress, {
    categoryNames = [], categoryColors = {}, selectedCategories = new Set(), stackOrder, onSegmentPress, spansMultipleYears = false,
} = {}) {
    const orderedCategories = (stackOrder && stackOrder.length > 0)
        ? stackOrder.filter(c => c !== 'Income')
        : categoryNames.filter(c => c !== 'Income');

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
            const visible = selectedCategories.has(category);
            return {
                value: visible ? withMinHeight(realValue) : 0,
                color: categoryColors[category] || '#BBBBBB',
                category,
                year: entry.year,
                month: entry.month,
                realValue,
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
