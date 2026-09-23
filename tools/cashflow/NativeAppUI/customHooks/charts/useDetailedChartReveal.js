import { useState, useEffect } from 'react';
import { InteractionManager } from 'react-native';

export function useDetailedChartReveal() {
    const [showDetailedChart, setShowDetailedChart] = useState(false);

    useEffect(() => {
        const task = InteractionManager.runAfterInteractions(() => {
            setShowDetailedChart(true);
        });

        return () => task.cancel();
    }, []);

    return showDetailedChart;
}