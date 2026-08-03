import { getMonthWindow, getDefaultMonthWindowStart, getMonthDataBounds, addMonths } from '../../utils/charts/monthWindow';
import { getYearWindow, getDefaultYearWindowStart, getYearDataBounds, syncYearWindowToMonthWindow } from '../../utils/charts/yearWindow';
import { useMemo, useState, useCallback } from 'react';
import { WINDOW_SIZE_OFFSET } from '../../utils/charts/chartWindowConfig';

export function useChartWindows(monthly, yearly) {
    const monthBounds = useMemo(() => getMonthDataBounds(monthly), [monthly]);
    const yearBounds = useMemo(() => getYearDataBounds(yearly), [yearly]);

    const [monthWindowStart, setMonthWindowStart] = useState(() => getDefaultMonthWindowStart(monthly));
    const [yearWindowStart, setYearWindowStart] = useState(() => getDefaultYearWindowStart(yearly));

    const monthWindow = useMemo(() => getMonthWindow(monthly, monthWindowStart.year, monthWindowStart.month), [monthly, monthWindowStart]);
    const yearWindowEntries = useMemo(() => getYearWindow(yearly, yearWindowStart), [yearly, yearWindowStart]);

    const monthWindowBoundsStart = useMemo(() => {
        if (!monthBounds) return null;
        return {
            earliestStart: { year: monthBounds.earliest.year, month: monthBounds.earliest.month },
            latestStart: addMonths(monthBounds.latest.year, monthBounds.latest.month, -WINDOW_SIZE_OFFSET),
        };
    }, [monthBounds]);

    const setMonthWindow = useCallback((newStart) => {
        let clamped = newStart;
        if (monthBounds) {
            const earliestStart = { year: monthBounds.earliest.year, month: monthBounds.earliest.month };
            const latestStart = addMonths(monthBounds.latest.year, monthBounds.latest.month, -WINDOW_SIZE_OFFSET);
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

    const setMonthWindowByIndex = useCallback((index) => {
        if (!monthBounds) return;
        setMonthWindow(addMonths(monthBounds.earliest.year, monthBounds.earliest.month, index));
    }, [monthBounds, setMonthWindow]);

    const scrollYearWindow = useCallback((deltaYears) => {
        setYearWindowStart(prev => {
            let next = prev + deltaYears;
            if (yearBounds) {
                const earliestStart = yearBounds.earliestYear;
                const latestStart = yearBounds.latestYear - WINDOW_SIZE_OFFSET;
                if (next < earliestStart) next = earliestStart;
                if (next > latestStart) next = latestStart;
            }
            return next;
        });
    }, [yearBounds]);

    const setYearWindowByIndex = useCallback((index) => {
        if (!yearBounds) return;
        let next = yearBounds.earliestYear + index;
        const latestStart = yearBounds.latestYear - WINDOW_SIZE_OFFSET;
        if (next < yearBounds.earliestYear) next = yearBounds.earliestYear;
        if (next > latestStart) next = latestStart;
        setYearWindowStart(next);
    }, [yearBounds]);

    const canScrollMonthBack = monthWindowBoundsStart
        ? (monthWindowStart.year * 100 + monthWindowStart.month) > (monthWindowBoundsStart.earliestStart.year * 100 + monthWindowBoundsStart.earliestStart.month)
        : false;

    const canScrollMonthForward = monthWindowBoundsStart
        ? (monthWindowStart.year * 100 + monthWindowStart.month) < (monthWindowBoundsStart.latestStart.year * 100 + monthWindowBoundsStart.latestStart.month)
        : false;

    const canScrollYearBack = yearBounds ? yearWindowStart > yearBounds.earliestYear : false;
    const canScrollYearForward = yearBounds ? yearWindowStart < (yearBounds.latestYear - WINDOW_SIZE_OFFSET) : false;

    // Max valid WINDOW-START index (used for clamping - the window
    // can't start later than 11 back from the true latest data point).
    const monthSliderMaxIndex = monthWindowBoundsStart
        ? (monthWindowBoundsStart.latestStart.year * 12 + monthWindowBoundsStart.latestStart.month) - (monthBounds.earliest.year * 12 + monthBounds.earliest.month)
        : 0;
    const monthSliderCurrentIndex = monthBounds
        ? (monthWindowStart.year * 12 + monthWindowStart.month) - (monthBounds.earliest.year * 12 + monthBounds.earliest.month)
        : 0;

    const yearSliderMaxIndex = yearBounds ? (yearBounds.latestYear - WINDOW_SIZE_OFFSET) - yearBounds.earliestYear : 0;
    const yearSliderCurrentIndex = yearBounds ? yearWindowStart - yearBounds.earliestYear : 0;

    // NEW - the FULL raw timeline span (not minus 11) - this is what
    // the two-handle slider's TRACK itself needs, since the RIGHT
    // handle must be able to visually reach the true latest data
    // point, even though the window's START can't go that far (that's
    // what monthSliderMaxIndex/yearSliderMaxIndex above still enforce).
    const monthSliderTrackMax = monthBounds
        ? (monthBounds.latest.year * 12 + monthBounds.latest.month) - (monthBounds.earliest.year * 12 + monthBounds.earliest.month)
        : 0;
    const yearSliderTrackMax = yearBounds ? yearBounds.latestYear - yearBounds.earliestYear : 0;

    return {
        monthWindow, yearWindowEntries,
        scrollMonthWindow, scrollYearWindow, jumpMonthWindowToYear,
        canScrollMonthBack, canScrollMonthForward,
        canScrollYearBack, canScrollYearForward,
        setMonthWindowByIndex, setYearWindowByIndex,
        monthSliderMaxIndex, monthSliderCurrentIndex,
        yearSliderMaxIndex, yearSliderCurrentIndex,
        monthSliderTrackMax, yearSliderTrackMax,
        monthBounds, yearBounds,
    };
}