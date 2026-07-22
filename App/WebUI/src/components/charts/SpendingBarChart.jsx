import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';

// filteredChartData2 shape from gifted-charts convention: array of
// { value, label, ... }. Recharts wants an array of plain objects with
// a shared key per field, so map to { name, value }.
export default function SpendingBarChart({ data }) {
    const chartData = data.map(d => ({ name: d.label, value: d.value }));

    return (
        <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Bar dataKey="value" fill="#2E5C8A" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
}