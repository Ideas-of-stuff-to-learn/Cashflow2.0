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

    // The SAME earliest/latest start bounds setMonthWindow uses to
    // clamp, computed here too (memoized) so both the clamp logic AND
    // the canScroll booleans below stay in sync with ONE source of
    // truth, rather than duplicating the bound calculation twice.
    const monthWindowBoundsStart = useMemo(() => {
        if (!monthBounds) return null;
        return {
            earliestStart: { year: monthBounds.earliest.year, month: monthBounds.earliest.month },
            latestStart: addMonths(monthBounds.latest.year, monthBounds.latest.month, -11),
        };
    }, [monthBounds]);

    const setMonthWindow = useCallback((newStart) => {
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

    // NEW - absolute jump, for the slider. `index` is 0-based, counted
    // from the earliest real month (index 0 = earliest month IS the
    // window's start). setMonthWindow already clamps, so an out-of-
    // range index (shouldn't happen if the slider's own min/max are
    // set correctly, but safe regardless) just clamps to the nearest
    // valid window.
    const setMonthWindowByIndex = useCallback((index) => {
        if (!monthBounds) return;
        setMonthWindow(addMonths(monthBounds.earliest.year, monthBounds.earliest.month, index));
    }, [monthBounds, setMonthWindow]);

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

    // NEW - same idea as setMonthWindowByIndex, for years. index 0 =
    // earliest year is the window's start.
    const setYearWindowByIndex = useCallback((index) => {
        if (!yearBounds) return;
        let next = yearBounds.earliestYear + index;
        const latestStart = yearBounds.latestYear - 11;
        if (next < yearBounds.earliestYear) next = yearBounds.earliestYear;
        if (next > latestStart) next = latestStart;
        setYearWindowStart(next);
    }, [yearBounds]);

    // NEW - whether each direction currently has anywhere left to go.
    // Compared against the SAME bounds used for clamping above, so
    // these are always consistent with what scrolling actually does.
    const canScrollMonthBack = monthWindowBoundsStart
        ? (monthWindowStart.year * 100 + monthWindowStart.month) > (monthWindowBoundsStart.earliestStart.year * 100 + monthWindowBoundsStart.earliestStart.month)
        : false;

    const canScrollMonthForward = monthWindowBoundsStart
        ? (monthWindowStart.year * 100 + monthWindowStart.month) < (monthWindowBoundsStart.latestStart.year * 100 + monthWindowBoundsStart.latestStart.month)
        : false;

    const canScrollYearBack = yearBounds ? yearWindowStart > yearBounds.earliestYear : false;
    const canScrollYearForward = yearBounds ? yearWindowStart < (yearBounds.latestYear - 11) : false;

    // NEW - the slider's own min/max range and current position, all
    // as plain 0-based indices so RangeWindowSlider never needs to
    // know about years/months/dates at all, just numbers.
    const monthSliderMaxIndex = monthBounds
        ? (monthBounds.latest.year * 12 + monthBounds.latest.month) - (monthBounds.earliest.year * 12 + monthBounds.earliest.month)
        : 0;
    const monthSliderCurrentIndex = monthBounds
        ? (monthWindowStart.year * 12 + monthWindowStart.month) - (monthBounds.earliest.year * 12 + monthBounds.earliest.month)
        : 0;

    const yearSliderMaxIndex = yearBounds ? yearBounds.latestYear - yearBounds.earliestYear : 0;
    const yearSliderCurrentIndex = yearBounds ? yearWindowStart - yearBounds.earliestYear : 0;

    return {
        monthWindow, yearWindowEntries,
        scrollMonthWindow, scrollYearWindow, jumpMonthWindowToYear,
        canScrollMonthBack, canScrollMonthForward,
        canScrollYearBack, canScrollYearForward,
        setMonthWindowByIndex, setYearWindowByIndex,
        monthSliderMaxIndex, monthSliderCurrentIndex,
        yearSliderMaxIndex, yearSliderCurrentIndex,
        monthBounds, yearBounds, // NEW - the raw earliest/latest bounds, for full-history slider labels
    };
}