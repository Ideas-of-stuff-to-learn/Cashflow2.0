import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../AppContext.js';
import { getChartSummary } from '../../api.js';
import { buildDummyTotals, toggleItem, selectAll } from '../../utils/charts/chartUtils.js';
import { buildYearStackData, buildMonthStackData } from '../../utils/charts/yearlyChartUtils.js';

export function useChartData() {
    const { categoryNames, categoryColors, processingStage } = useApp();

    const [summary, setSummary] = useState({ yearly: [], monthly: [] });
    const [selectedBar, setSelectedBar] = useState(null);
    const [selectedSegment, setSelectedSegment] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [selectedYearSegment, setSelectedYearSegment] = useState(null);
    const [selectedCategories, setSelectedCategories] = useState(new Set());

    // Same convention as before: dummy data is shown specifically while
    // checking the cache, nothing more subtle than that.
    const showingDummyData = processingStage === 'checkingCache';

    // Fetched once on mount (picks up existing history), and refetched
    // any time processing moves PAST the "checking cache" stage - that's
    // when freshly categorised rows actually land in the transactions
    // table, so the aggregate is worth asking for again. Deliberately
    // does NOT fetch while still checkingCache, since nothing new has
    // been committed to the database yet at that point - fetching then
    // would just return the same stale numbers.
    useEffect(() => {
        if (processingStage === 'checkingCache') return;

        let cancelled = false;
        getChartSummary()
            .then(data => {
                if (!cancelled) setSummary(data);
            })
            .catch(e => console.warn('Failed to load chart summary:', e.message));

        return () => { cancelled = true; };
    }, [processingStage]);

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