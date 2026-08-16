import { useMemo, useState, useCallback } from 'react';
import { getMonthWindow, getDefaultMonthWindowStart, getMonthDataBounds, addMonths } from '../../../shared/utils/monthWindow.js';
import { getYearWindow, getDefaultYearWindowStart, getYearDataBounds, syncYearWindowToMonthWindow } from '../../../shared/utils/yearWindow.js';
import { WINDOW_SIZE_OFFSET } from '../../../shared/utils/chartWindowConfig.js';

export function useChartWindows(monthly, yearly) {
    const monthBounds = useMemo(() => getMonthDataBounds(monthly), [monthly]);
    const yearBounds = useMemo(() => getYearDataBounds(yearly), [yearly]);

    const [monthWindowStart, setMonthWindowStart] = useState(() => getDefaultMonthWindowStart(monthly));
    const [yearWindowStart, setYearWindowStart] = useState(() => getDefaultYearWindowStart(yearly));

    const monthWindow = useMemo(() => getMonthWindow(monthly, monthWindowStart.year, monthWindowStart.month), [monthly, monthWindowStart]);
    const yearWindowEntries = useMemo(() => getYearWindow(yearly, yearWindowStart), [yearly, yearWindowStart]);

    const monthWindowBoundsStart = useMemo(() => {
        if (!monthBounds) return null;
        const earliestStart = { year: monthBounds.earliest.year, month: monthBounds.earliest.month };
        let latestStart = addMonths(monthBounds.latest.year, monthBounds.latest.month, -WINDOW_SIZE_OFFSET);
        const earliestKey = earliestStart.year * 100 + earliestStart.month;
        const latestKey = latestStart.year * 100 + latestStart.month;
        if (latestKey < earliestKey) latestStart = earliestStart;
        return { earliestStart, latestStart };
    }, [monthBounds]);

    const setMonthWindow = useCallback((newStart) => {
        let clamped = newStart;
        if (monthBounds) {
            const earliestStart = { year: monthBounds.earliest.year, month: monthBounds.earliest.month };
            let latestStart = addMonths(monthBounds.latest.year, monthBounds.latest.month, -WINDOW_SIZE_OFFSET);
            const earliestKey = earliestStart.year * 100 + earliestStart.month;
            let latestKey = latestStart.year * 100 + latestStart.month;
            if (latestKey < earliestKey) { latestStart = earliestStart; latestKey = earliestKey; }
            const clampedKey = newStart.year * 100 + newStart.month;
            if (clampedKey < earliestKey) clamped = earliestStart;
            else if (clampedKey > latestKey) clamped = latestStart;
        }
        setMonthWindowStart(clamped);
        const newMonthWindow = getMonthWindow(monthly, clamped.year, clamped.month);
        setYearWindowStart(prev => syncYearWindowToMonthWindow(prev, newMonthWindow));
    }, [monthly, monthBounds]);

    const scrollMonthWindow = useCallback((deltaMonths) => {
        setMonthWindow(addMonths(monthWindowStart.year, monthWindowStart.month, deltaMonths));
    }, [monthWindowStart, setMonthWindow]);

    const jumpMonthWindowToYear = useCallback((year) => {
        setMonthWindow({ year, month: 1 });
    }, [setMonthWindow]);

    const scrollYearWindow = useCallback((deltaYears) => {
        setYearWindowStart(prev => {
            let next = prev + deltaYears;
            if (yearBounds) {
                const earliestStart = yearBounds.earliestYear;
                let latestStart = yearBounds.latestYear - WINDOW_SIZE_OFFSET;
                if (latestStart < earliestStart) latestStart = earliestStart;
                if (next < earliestStart) next = earliestStart;
                if (next > latestStart) next = latestStart;
            }
            return next;
        });
    }, [yearBounds]);

    const canScrollMonthBack = monthWindowBoundsStart
        ? (monthWindowStart.year * 100 + monthWindowStart.month) > (monthWindowBoundsStart.earliestStart.year * 100 + monthWindowBoundsStart.earliestStart.month)
        : false;
    const canScrollMonthForward = monthWindowBoundsStart
        ? (monthWindowStart.year * 100 + monthWindowStart.month) < (monthWindowBoundsStart.latestStart.year * 100 + monthWindowBoundsStart.latestStart.month)
        : false;
    const canScrollYearBack = yearBounds ? yearWindowStart > yearBounds.earliestYear : false;
    const canScrollYearForward = yearBounds
        ? yearWindowStart < Math.max(yearBounds.earliestYear, yearBounds.latestYear - WINDOW_SIZE_OFFSET)
        : false;

    return {
        monthBounds, yearBounds,
        monthWindow, yearWindowEntries,
        scrollMonthWindow, scrollYearWindow, jumpMonthWindowToYear,
        canScrollMonthBack, canScrollMonthForward,
        canScrollYearBack, canScrollYearForward,
    };
}
