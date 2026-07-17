import { useState, useMemo, useCallback } from 'react';
import { useApp } from '../../AppContext.js';
import { buildDummyTotals, toggleItem, selectAll } from '../../utils/charts/chartUtils.js';
import { buildYearStackData, buildMonthStackData } from '../../utils/charts/yearlyChartUtils.js';

export function useChartData() {
    const { categoryNames, categoryColors, processingStage, chartSummary } = useApp();

    const summary = chartSummary;
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
        () => buildYearStackData(yearly, categoryNames, categoryColors, selectedCategories, handleYearSegmentPress),
        [yearly, categoryNames, categoryColors, selectedCategories, handleYearSegmentPress]
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
                onPress: () => setSelectedBar({ category, total }),
            }));
    }, [yearly]);

    const monthChartData = useMemo(
        () => buildMonthStackData(summary.monthly, selectedYear, categoryNames, categoryColors, selectedCategories, handleMonthSegmentPress),
        [summary.monthly, selectedYear, categoryNames, categoryColors, selectedCategories, handleMonthSegmentPress]
    );

    const monthIncomeLineData = useMemo(() => {
        if (selectedYear == null) return [];
        const monthsInYear = summary.monthly.filter(r => r.year === selectedYear);
        const months = [...new Set(monthsInYear.map(r => r.month))].sort((a, b) => a - b);
        const incomeByMonth = {};
        monthsInYear.forEach(r => {
            if (r.category === 'Income') incomeByMonth[r.month] = (incomeByMonth[r.month] || 0) + r.total;
        });
        return months.map(m => ({ value: incomeByMonth[m] || 0 }));
    }, [summary.monthly, selectedYear]);

    return {
        showingDummyData,
        hasData,
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