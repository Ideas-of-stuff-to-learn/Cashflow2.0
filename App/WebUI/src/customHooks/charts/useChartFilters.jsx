import { useState, useMemo } from 'react';
import {toggleItem, selectAll} from '../../utils/charts/chartUtils'
export function useChartFilters(chartData, chartData2, incomeByMonth, months) {
    const [selectedMonths, setSelectedMonths] = useState(new Set());
    const [selectedCategories, setSelectedCategories] = useState(new Set());



    const filteredChartData = useMemo(() => (
        chartData
            .filter(bar => selectedMonths.size === 0 || selectedMonths.has(bar.label))
            .map(bar => ({
                ...bar,
                stacks: bar.stacks.map(stack => ({
                    ...stack,
                    value:
                        selectedCategories.size === 0 ||
                        selectedCategories.has(stack.category)
                            ? stack.value
                            : 0,
                }))
            }))
    ), [chartData, selectedMonths, selectedCategories]);

    const filteredIncomeLineData = useMemo(() => (
        months
            .filter(month => selectedMonths.size === 0 || selectedMonths.has(month))
            .map(month => ({
                value: incomeByMonth[month] || 0, // careful, see note below
            }))
    ), [months, selectedMonths]);

    const filteredChartData2 = useMemo(() => (
        chartData2.filter(item =>
            selectedCategories.size === 0 ||
            selectedCategories.has(item.label)
        )
    ), [chartData2, selectedCategories]);

    return {
        selectedMonths, setSelectedMonths,
        selectedCategories, setSelectedCategories,
        toggleItem, selectAll,
        filteredChartData, filteredIncomeLineData, filteredChartData2,
    };
}