// customHooks/charts/useChartData.js
import { useState, useMemo, useCallback } from 'react';
import { useStackOrder } from './useStackOrder';
import { useChartWindows } from './useChartWindows';
import { useApp } from '../../AppContext';
import { toggleItem, selectAll } from '../../utils/charts/chartUtils';
import { buildStackDataFromEntries, buildIncomeDataFromEntries } from '../../utils/charts/buildStackData';

export function useChartData() {
    const { categoryNames, categoryColors, processingStage, chartSummary } = useApp();

    const summary = chartSummary;
    const {
        effectiveOrder, stackOrder, updateOrder, resetOrder, persist, togglePersist, isCustomOrder,
    } = useStackOrder(categoryNames);

    const [selectedSegment, setSelectedSegment] = useState(null);
    const [selectedCategories, setSelectedCategories] = useState(new Set());

    const availableCategories = useMemo(
        () => categoryNames.filter(c => c !== 'Income'),
        [categoryNames]
    );

    const handleSegmentPress = useCallback(({ year, month, category, value }) => {
        setSelectedSegment({ year, month, category, value });
    }, []);

    const hasData = summary.yearly.length > 0;

    const {
        monthWindow, yearWindowEntries,
        scrollMonthWindow, scrollYearWindow, jumpMonthWindowToYear,
    } = useChartWindows(summary.monthly, summary.yearly);

    const monthWindowSpansMultipleYears = useMemo(() => {
        const years = new Set(monthWindow.map(m => m.year));
        return years.size > 1;
    }, [monthWindow]);

    // ONE builder function, reused for whichever window is actually
    // visible - ChartWindowSection calls this itself with the active
    // window's entries, rather than both being precomputed here every
    // render regardless of which one the toggle currently shows.
    const buildStackData = useCallback((entries) => {
        return buildStackDataFromEntries(entries, {
            categoryNames,
            categoryColors,
            selectedCategories,
            stackOrder: effectiveOrder,
            onSegmentPress: handleSegmentPress,
            spansMultipleYears: monthWindowSpansMultipleYears,
        });
    }, [categoryNames, categoryColors, selectedCategories, effectiveOrder, handleSegmentPress, monthWindowSpansMultipleYears]);

    const allTimeChartData2 = useMemo(() => {
        const totals = {};
        summary.yearly.forEach(r => {
            if (r.category === 'Income') return;
            totals[r.category] = (totals[r.category] || 0) + r.total;
        });
        return Object.entries(totals).map(([label, value]) => ({ label, value }));
    }, [summary.yearly]);

    return {
        hasData,
        effectiveOrder, isCustomOrder, updateOrder, resetOrder, persist, togglePersist,
        availableCategories, selectedCategories, setSelectedCategories,
        toggleItem, selectAll,
        allTimeChartData2,
        selectedSegment,

        monthWindow, yearWindowEntries,
        scrollMonthWindow, scrollYearWindow, jumpMonthWindowToYear,
        buildStackDataFromEntries: buildStackData,
        incomeForEntries: buildIncomeDataFromEntries,
    };
}