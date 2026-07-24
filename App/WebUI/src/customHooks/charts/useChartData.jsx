import { useState, useMemo, useCallback } from 'react';
import { useStackOrder } from './useStackOrder';
import { useApp } from '../../AppContext';
import { buildDummyTotals, toggleItem, selectAll } from '../../utils/charts/chartUtils';
import { buildYearStackData, selectMonthsForDrilldownAdjacentOnly, buildMonthStackDataFromEntries } from '../../utils/charts/yearlyChartUtils';

export function useChartData() {
    const { categoryNames, categoryColors, processingStage, chartSummary } = useApp();

    const summary = chartSummary;
    const {
        effectiveOrder,
        stackOrder,
        updateOrder,
        resetOrder,
        persist,
        togglePersist,
        isCustomOrder,
    } = useStackOrder(categoryNames);

    const [selectedBar, setSelectedBar] = useState(null);
    const [selectedSegment, setSelectedSegment] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [selectedYearSegment, setSelectedYearSegment] = useState(null);
    const [selectedCategories, setSelectedCategories] = useState(new Set());

    // Dummy data is shown only while we have genuinely nothing real to
    // show yet AND something is actively in progress - NOT for the
    // entire duration of a processing stage. A stage like checkingCache
    // can span many separate chunks (see useFileProcessor.js), each of
    // which commits real rows to the DB as it finishes - once
    // summary.yearly has anything in it, that's real data and should
    // be shown immediately, even if the stage hasn't moved on yet.
    const showingDummyData = summary.yearly.length === 0
        && (processingStage === 'parsing' || processingStage === 'checkingCache' || processingStage === 'waitingForLLM');

    // chartSummary itself now lives in AppContext (see the effect
    // there, keyed on chartDataVersion) - it stays fresh in the
    // background regardless of whether this screen is even mounted,
    // so there's nothing left to fetch here. This hook just reads it.

    const dummyTotals = useMemo(() => buildDummyTotals(categoryNames), [categoryNames]);

    const availableCategories = useMemo(
        () => categoryNames.filter(c => c !== 'Income'),
        [categoryNames]
    );

    // Clicking a segment in the YEAR chart opens the month drill-down for
    // that year, showing EVERY category (deliberately does NOT narrow
    // selectedCategories - that's what caused "closing it leaves you stuck
    // on one category" before, since nothing was left to reset it back).
    // What was clicked is only remembered for the small info text shown
    // below the year chart - it doesn't filter anything.
    const handleYearSegmentPress = useCallback(({ year, category, value }) => {
        setSelectedYear(year);
        setSelectedYearSegment({ year, category, value });
    }, []);

    const handleMonthSegmentPress = useCallback(({ year, month, category, value }) => {
        setSelectedSegment({ year, month, category, value });
    }, []);

    const closeDrilldown = useCallback(() => {
        setSelectedYear(null);
        setSelectedYearSegment(null);
        setSelectedSegment(null);
    }, []);

    // While showing dummy data, fabricate a single fake year's worth of
    // totals from the same category-name-shaped dummy generator used
    // elsewhere, so the year chart has SOMETHING to render.
    const yearly = showingDummyData
        ? Object.entries(dummyTotals).map(([category, total]) => ({
            year: new Date().getFullYear(),
            category,
            total,
        }))
        : summary.yearly;

    const hasData = yearly.length > 0;

    // Total spend for the currently drilled-into year (all categories,
    // excluding Income, matching what the stacked bar itself represents).
    // Pure client-side sum over data already fetched - no new backend call.
    const selectedYearTotal = useMemo(() => {
        if (selectedYear == null) return 0;
        return yearly
            .filter(r => r.year === selectedYear && r.category !== 'Income')
            .reduce((sum, r) => sum + r.total, 0);
    }, [yearly, selectedYear]);

    const yearChartData = useMemo(
        () => buildYearStackData(yearly, categoryNames, categoryColors, selectedCategories, handleYearSegmentPress, effectiveOrder),
        [yearly, categoryNames, categoryColors, selectedCategories, handleYearSegmentPress, effectiveOrder]
    );

    const yearIncomeLineData = useMemo(() => {
        const years = [...new Set(yearly.map(r => r.year))].sort((a, b) => a - b);
        const incomeByYear = {};
        yearly.forEach(r => {
            if (r.category === 'Income') incomeByYear[r.year] = (incomeByYear[r.year] || 0) + r.total;
        });
        return years.map(y => ({ value: incomeByYear[y] || 0 }));
    }, [yearly]);

    // All-time totals per category, collapsing the year dimension - this
    // feeds the existing SpendingOverview bar. Deliberately NOT filtered
    // by selectedCategories: that state also gets auto-narrowed to a
    // single category the moment you click a year-segment (see
    // handleYearSegmentPress above), which is meant to scope the MONTH
    // drill-down, not silently collapse this unrelated all-time summary
    // down to one category too. This chart always shows everything.
    // onBarPress is stable (useCallback, empty deps) so it doesn't
    // invalidate allTimeChartData2's memo when it's included as a dep.
    // Previously the onPress arrow was defined inline inside the useMemo,
    // creating a new function reference on every run and causing
    // allTimeChartData2 to change identity even when the data hadn't -
    // defeating React.memo on SpendingStackedChart.
    const onBarPress = useCallback((category, total) => {
        setSelectedBar({ category, total });
    }, []);

    const allTimeChartData2 = useMemo(() => {
        const totals = {};
        yearly.forEach(r => {
            if (r.category === 'Income') return;
            totals[r.category] = (totals[r.category] || 0) + r.total;
        });
        return Object.entries(totals)
            .map(([category, total]) => ({
                value: total,
                label: category,
                // onPress is now a stable callback (see above) called
                // with (category, total) by SpendingBarChart, not an
                // inline arrow that recreates on every useMemo run.
                onPress: () => onBarPress(category, total),
            }));
    }, [yearly, onBarPress]);

    // If the drilled-into year has fewer than 12 months of data, this
    // backfills the remaining bars from the closest prior months
    // available anywhere in history (walking back across year
    // boundaries as needed), never inventing data if history simply
    // runs out first. Computed once here and reused for both the bars
    // and the income line below so the two stay index-aligned - see
    // selectMonthsForDrilldown in yearlyChartUtils.js for the full
    // selection logic. Pure client-side work over `summary.monthly`,
    // which already holds the account's full history (no per-year
    // fetch), so this is synchronous and doesn't touch the network.
    const drilldownMonths = useMemo(
        () => selectMonthsForDrilldownAdjacentOnly(summary.monthly, selectedYear),
        [summary.monthly, selectedYear]
    );

    const monthChartData = useMemo(
        () => buildMonthStackDataFromEntries(drilldownMonths, categoryNames, categoryColors, selectedCategories, handleMonthSegmentPress, effectiveOrder),
        [drilldownMonths, categoryNames, categoryColors, selectedCategories, handleMonthSegmentPress, effectiveOrder]
    );

    const monthIncomeLineData = useMemo(
        () => drilldownMonths.map(({ categoryTotals }) => ({ value: categoryTotals['Income'] || 0 })),
        [drilldownMonths]
    );

    return {
        showingDummyData,
        hasData,
        effectiveOrder,
        stackOrder,
        updateOrder,
        resetOrder,
        persist,
        togglePersist,
        isCustomOrder,
        yearChartData,
        yearIncomeLineData,
        allTimeChartData2,
        selectedBar,
        selectedYear,
        selectedYearSegment,
        selectedYearTotal,
        monthChartData,
        monthIncomeLineData,
        selectedSegment,
        availableCategories,
        selectedCategories,
        setSelectedCategories,
        toggleItem,
        selectAll,
        closeDrilldown,
    };
}