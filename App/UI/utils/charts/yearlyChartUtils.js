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
// stackOrder: an ordered list of category names to use for segment
// stacking (bottom to top). When null/undefined, falls back to
// categoryNames order. Income is always excluded from stacks regardless.
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

    // Use custom stackOrder if provided, otherwise fall back to categoryNames.
    // Income excluded either way - it's shown as a line overlay, not a segment.
    const orderedCategories = stackOrder
        ? stackOrder.filter(c => c !== 'Income')
        : categoryNames.filter(category => category !== 'Income');

    return years.map(year => {
        const categoryTotals = totalsByYear[year] || {};
        const stacks = orderedCategories
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

const DEFAULT_DRILLDOWN_TARGET = 12;

// `monthly` ({year, month, category, total}) already contains every
// year the account has ever uploaded (see backend.py's /charts/summary -
// no year filter in the SQL), so all of this is pure client-side work
// over data that's already sitting in memory. No extra fetch, nothing
// async, nothing that blocks - same synchronous useMemo pattern as
// buildYearStackData above.
//
// Groups the flat monthly rows into one entry per (year, month), each
// carrying its own category->total map (Income included - callers that
// need the income line pull it back out of categoryTotals themselves).
function groupMonthlyByYearMonth(monthly) {
    const map = new Map();
    for (const row of monthly) {
        const key = row.year * 100 + row.month; // e.g. 202603 - sorts naturally too
        let entry = map.get(key);
        if (!entry) {
            entry = { year: row.year, month: row.month, categoryTotals: {} };
            map.set(key, entry);
        }
        entry.categoryTotals[row.category] = (entry.categoryTotals[row.category] || 0) + row.total;
    }
    return [...map.values()];
}

// Picks which (year, month) bars the month drill-down should show for
// `year`. Starts with every real month `year` actually has. If that's
// fewer than `targetCount`, backfills the rest from the CLOSEST prior
// months available anywhere in history - walking backward in time
// across year boundaries as needed (year - 1, year - 2, ...) - until
// either targetCount is reached or history runs out. Never invents
// data: if there simply isn't `targetCount` months anywhere in the
// account's history, this returns fewer than targetCount and that's
// the final answer, not padded with anything fake.
export function selectMonthsForDrilldown(monthly, year, targetCount = DEFAULT_DRILLDOWN_TARGET) {
    if (year == null) return [];

    const allEntries = groupMonthlyByYearMonth(monthly);

    const realMonths = allEntries
        .filter(e => e.year === year)
        .sort((a, b) => a.month - b.month);

    const needed = targetCount - realMonths.length;
    if (needed <= 0) return realMonths;

    // Every month strictly before `year`, closest-first (most recent
    // year/month first) - so taking the first `needed` of these is
    // exactly "start from the nearest available month and go
    // backwards", automatically rolling into an earlier year once the
    // nearer one runs out, with no special-casing needed for that.
    const backfillPool = allEntries
        .filter(e => e.year < year)
        .sort((a, b) => (b.year - a.year) || (b.month - a.month));

    const backfill = backfillPool.slice(0, needed);

    return [...backfill, ...realMonths].sort((a, b) => (a.year - b.year) || (a.month - b.month));
}

// Same idea as buildYearStackData, one level down - builds one stacked
// bar per (year, month) entry already selected by
// selectMonthsForDrilldown. Kept separate from that selection step so
// callers needing the same set of months for something else (the
// income line, see useChartData.js) can reuse the exact same entries
// instead of re-deriving a possibly-different set.
export function buildMonthStackDataFromEntries(entries, categoryNames, categoryColors, selectedCategories, onSegmentPress, stackOrder) {
    if (entries.length === 0) return [];

    // Backfilled months come from a different year than the one the
    // user drilled into, so once backfill has actually happened, a
    // bare "Mar" label would be ambiguous against another Mar from a
    // different year. Only add the year suffix when it's actually
    // needed (more than one calendar year present) - a full, unbackfilled
    // year keeps the plain month label exactly as before.
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
        const stacks = orderedCategories
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
        const monthName = MONTH_LABELS[month - 1] || String(month);
        const label = spansMultipleYears ? `${monthName} '${String(year).slice(2)}` : monthName;
        return { label, stacks };
    });
}

// Convenience wrapper for callers that just want the bars in one call
// and don't need to reuse the underlying (year, month) selection for
// anything else.
export function buildMonthStackData(monthly, year, categoryNames, categoryColors, selectedCategories, onSegmentPress, targetCount = DEFAULT_DRILLDOWN_TARGET) {
    const entries = selectMonthsForDrilldown(monthly, year, targetCount);
    return buildMonthStackDataFromEntries(entries, categoryNames, categoryColors, selectedCategories, onSegmentPress);
}

export function monthLabel(monthNumber) {
    return MONTH_LABELS[monthNumber - 1] || String(monthNumber);
}