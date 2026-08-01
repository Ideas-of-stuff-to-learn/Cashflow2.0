// customHooks/charts/useChartWindows.js
import { useState, useMemo, useCallback } from 'react';
import { getMonthWindow, getDefaultMonthWindowStart, addMonths } from '../../utils/charts/monthWindow';
import { getYearWindow, getDefaultYearWindowStart, syncYearWindowToMonthWindow } from '../../utils/charts/yearWindow';

// Owns both windows' positions and the one-way sync between them.
// Nothing about rendering lives here - this is purely "where are the
// two windows currently pointing, and what are the rules for moving
// them" - components read the resulting 12-entry arrays and render
// whichever one the toggle currently has selected.
export function useChartWindows(monthly, yearly) {
    const [monthWindowStart, setMonthWindowStart] = useState(() =>
        getDefaultMonthWindowStart(monthly)
    );
    const [yearWindowStart, setYearWindowStart] = useState(() =>
        getDefaultYearWindowStart(yearly)
    );

    const monthWindow = useMemo(
        () => getMonthWindow(monthly, monthWindowStart.year, monthWindowStart.month),
        [monthly, monthWindowStart]
    );

    const yearWindowEntries = useMemo(
        () => getYearWindow(yearly, yearWindowStart),
        [yearly, yearWindowStart]
    );

    // The ONLY function that moves the month window. Every caller -
    // manual scroll, or a year-bar click - goes through this, and
    // every call here also re-syncs the year window (one-way, per the
    // rule: month movement may adjust the year window, year movement
    // never touches the month window).
    const setMonthWindow = useCallback((newStart) => {
        setMonthWindowStart(newStart);
        const newMonthWindow = getMonthWindow(monthly, newStart.year, newStart.month);
        setYearWindowStart(prev => syncYearWindowToMonthWindow(prev, newMonthWindow));
    }, [monthly]);

    // Scroll the month window by N months (negative = backward,
    // positive = forward) - the actual function a horizontal-scroll
    // gesture/button will call.
    const scrollMonthWindow = useCallback((deltaMonths) => {
        setMonthWindow(addMonths(monthWindowStart.year, monthWindowStart.month, deltaMonths));
    }, [monthWindowStart, setMonthWindow]);

    // Called when a year bar is clicked (in Year mode) - jumps the
    // month window to that year's own 12 months (Jan-Dec of that
    // year), per your spec: a year click sets which window Month mode
    // would show, without auto-switching modes.
    const jumpMonthWindowToYear = useCallback((year) => {
        setMonthWindow({ year, month: 1 });
    }, [setMonthWindow]);

    // Scrolling the YEAR window is completely independent - it never
    // touches the month window at all, per the one-way rule.
    const scrollYearWindow = useCallback((deltaYears) => {
        setYearWindowStart(prev => prev + deltaYears);
    }, []);

    return {
        monthWindow,
        yearWindowEntries,
        scrollMonthWindow,
        scrollYearWindow,
        jumpMonthWindowToYear,
    };
}