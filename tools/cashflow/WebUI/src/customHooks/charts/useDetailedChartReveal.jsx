import { useState, useEffect } from 'react';

export function useDetailedChartReveal() {
    const [showDetailedChart, setShowDetailedChart] = useState(false);

    useEffect(() => {
        const frameId = requestAnimationFrame(() => {
            setShowDetailedChart(true);
        });

        return () => cancelAnimationFrame(frameId);
    }, []);

    return showDetailedChart;
}