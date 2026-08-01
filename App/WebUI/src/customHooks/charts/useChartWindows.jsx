import { getMonthWindow, getDefaultMonthWindowStart, getMonthDataBounds, addMonths } from '../../utils/charts/monthWindow';
import { getYearWindow, getDefaultYearWindowStart, getYearDataBounds, syncYearWindowToMonthWindow } from '../../utils/charts/yearWindow';
import { useMemo, useState, useCallback } from 'react';
export function useChartWindows(monthly, yearly) {
    const monthBounds = useMemo(() => getMonthDataBounds(monthly), [monthly]);
    const yearBounds = useMemo(() => getYearDataBounds(yearly), [yearly]);

    const [monthWindowStart, setMonthWindowStart] = useState(() => getDefaultMonthWindowStart(monthly));
    const [yearWindowStart, setYearWindowStart] = useState(() => getDefaultYearWindowStart(yearly));

    const monthWindow = useMemo(() => getMonthWindow(monthly, monthWindowStart.year, monthWindowStart.month), [monthly, monthWindowStart]);
    const yearWindowEntries = useMemo(() => getYearWindow(yearly, yearWindowStart), [yearly, yearWindowStart]);

    const setMonthWindow = useCallback((newStart) => {
        // Clamp so the window's start never goes earlier than the
        // earliest real month, and never later than 11 months before
        // the latest real month (so the window's LAST slot never
        // exceeds real data either).
        let clamped = newStart;
        if (monthBounds) {
            const earliestStart = { year: monthBounds.earliest.year, month: monthBounds.earliest.month };
            const latestStart = addMonths(monthBounds.latest.year, monthBounds.latest.month, -11);
            const clampedKey = newStart.year * 100 + newStart.month;
            const earliestKey = earliestStart.year * 100 + earliestStart.month;
            const latestKey = latestStart.year * 100 + latestStart.month;
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
                const latestStart = yearBounds.latestYear - 11;
                if (next < earliestStart) next = earliestStart;
                if (next > latestStart) next = latestStart;
            }
            return next;
        });
    }, [yearBounds]);

    return { monthWindow, yearWindowEntries, scrollMonthWindow, scrollYearWindow, jumpMonthWindowToYear };
}