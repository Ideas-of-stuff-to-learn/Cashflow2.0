import React from 'react';
import { BarChart } from 'react-native-gifted-charts';

function SpendingBarChart({ data }) {
    return (
        <BarChart
            data={data}
            barWidth={32}
            spacing={20}
            roundedTop
            frontColor="#2E5C8A"
            yAxisThickness={1}
            xAxisThickness={1}
        />
    );
}

export default React.memo(SpendingBarChart);