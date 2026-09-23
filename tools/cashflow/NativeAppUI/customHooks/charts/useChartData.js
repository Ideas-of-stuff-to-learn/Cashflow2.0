import { useMemo, useCallback, useState } from 'react';
import { useStackOrder } from './useStackOrder.js';
import { useChartWindows } from './useChartWindows.js';
import { useApp } from '../../AppContext.js';
import { buildStackDataFromEntries, buildIncomeDataFromEntries } from '../../../shared/utils/buildStackData.js';

export function useChartData() {
    const { categoryNames, categoryColors, processingStage, chartSummary, selectedCategories, toggleCategory, toggleAllCategories } = useApp();

    const summary = chartSummary;
    const {
        effectiveOrder, stackOrder, updateOrder, resetOrder, persist, togglePersist, isCustomOrder,
    } = useStackOrder(categoryNames);

    const [selectedSegment, setSelectedSegment] = useState(null);

    const availableCategories = useMemo(
        () => categoryNames.filter(c => c !== 'Income'),
        [categoryNames]
    );

    const hasData = summary.yearly.length > 0;

    const {
        monthBounds, yearBounds,
        monthWindow, yearWindowEntries,
        scrollMonthWindow, scrollYearWindow, jumpMonthWindowToYear,
        canScrollMonthBack, canScrollMonthForward,
        canScrollYearBack, canScrollYearForward,
    } = useChartWindows(summary.monthly, summary.yearly);

    const monthWindowSpansMultipleYears = useMemo(() => {
        const years = new Set(monthWindow.map(m => m.year));
        return years.size > 1;
    }, [monthWindow]);

    const handleSegmentPress = useCallback(({ year, month, category, value }) => {
        setSelectedSegment({ year, month, category, value });
    }, []);

    const buildStackData = useCallback((entries, extraOnPress) => {
        return buildStackDataFromEntries(entries, extraOnPress, {
            categoryNames,
            categoryColors,
            selectedCategories,
            stackOrder: effectiveOrder,
            onSegmentPress: handleSegmentPress,
            spansMultipleYears: monthWindowSpansMultipleYears,
        });
    }, [categoryNames, categoryColors, selectedCategories, effectiveOrder, handleSegmentPress, monthWindowSpansMultipleYears]);

    return {
        hasData,
        effectiveOrder, isCustomOrder, updateOrder, resetOrder, persist, togglePersist,
        availableCategories,
        selectedCategories, toggleCategory,
        toggleAllCategories: () => toggleAllCategories(availableCategories),
        selectedSegment,
        monthBounds, yearBounds,
        monthWindow, yearWindowEntries,
        scrollMonthWindow, scrollYearWindow, jumpMonthWindowToYear,
        canScrollMonthBack, canScrollMonthForward,
        canScrollYearBack, canScrollYearForward,
        buildStackDataFromEntries: buildStackData,
        incomeForEntries: buildIncomeDataFromEntries,
    };
}
