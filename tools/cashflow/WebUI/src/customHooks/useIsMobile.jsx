// customHooks/useIsMobile.js
import { useState, useEffect } from 'react';
import { MOBILE_BREAKPOINT_PX } from '../config/breakpoints';

// Tracks whether the viewport is currently below MOBILE_BREAKPOINT_PX,
// live - updates on resize/rotate, not just checked once on mount.
// Uses matchMedia's own change listener rather than a resize event
// handler, since matchMedia only fires when the query's result
// actually flips (crossing the breakpoint), not on every pixel of
// resize - cheaper, and exactly the granularity we need.
export function useIsMobile() {
    const query = `(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`;
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? window.matchMedia(query).matches : false
    );

    useEffect(() => {
        const mql = window.matchMedia(query);
        const handler = (e) => setIsMobile(e.matches);
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, [query]);

    return isMobile;
}