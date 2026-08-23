export function getMonthLabel(dateString) {
    const [day, month, year] = dateString.split('/');
    return `${month}-${year}`;
}


export function groupByMonthAndCategory(rows) {
    const byMonth = {};

    for (const row of rows) {
        const month = getMonthLabel(row.date);

        if (!byMonth[month]) {
            byMonth[month] = {};
        }

        const current = byMonth[month][row.category] || 0;
        byMonth[month][row.category] =
            current + Math.abs(row.amount);
    }

    return byMonth;
}


export function buildStackedChartData(
    byMonth,
    onSegmentPress,
    categoryNames,
    categoryColors
) {
    const months = Object.keys(byMonth).sort();

    return months.map((month) => {
        const categoryTotals = byMonth[month];

        const stacks = categoryNames
            .filter(category => category !== 'Income')
            .map(category => ({
                value: categoryTotals[category] || 0,
                color: categoryColors[category] || '#BBBBBB',
                category,
                onPress: () =>
                    onSegmentPress({
                        category,
                        value: categoryTotals[category] || 0,
                        month
                    }),
            }));

        return {
            label: month,
            stacks,
        };
    });
}


export function sumByCategory(rows) {
    const totals = {};

    for (const row of rows) {
        const current = totals[row.category] || 0;
        totals[row.category] =
            current + Math.abs(row.amount);
    }

    return totals;
}


export function buildDummyTotals(categoryNames) {
    const totals = {};

    categoryNames
        .filter(category => category !== 'Income')
        .forEach(category => {
            totals[category] =
                Math.floor(Math.random() * 900) + 50;
        });

    return totals;
}

// Fixed swatch palette for the colour picker - reusing the original
// seeded colours, since they're already chosen to be distinct and
// legible on the charts. Not tied to any specific category; any
// swatch can be applied to any selected category.


export const COLOR_PALETTE = [
  '#2E5C8A', '#E07A3E', '#3D8B5F', '#9B3D8A', '#C4A227',
  '#D94F4F', '#4FA8D9', '#7A5C3D', '#5C8A2E', '#D97AB8',
  '#3D5C8A', '#8A3D3D', '#4DBFBF', '#A67C52',
];



export function transformValue(value, maxVal, heightScale) {
  // Normalise to 0-1 range so sqrt transform is meaningful regardless
  // of the scale of your actual spending amounts
  const normalised = value / maxVal;
  
  // sqrt of the normalised value - compresses large, expands small
  const stretched = Math.sqrt(normalised);
  
  // lerp between raw and stretched based on how far the slider is dragged
  // at heightScale=1: fully raw. at heightScale=4: fully stretched.
  const t = (heightScale - 1) / 3; // 0 at scale=1, 1 at scale=4
  
  return (normalised * (1 - t) + stretched * t) * maxVal;
}

export function toggleItem(set, setFn, item) {
    const next = new Set(set);
    next.has(item) ? next.delete(item) : next.add(item);
    setFn(next);
}

export function selectAll(setFn) {
    setFn(new Set());
}