import '../../styles/chartStyles.css';

// Pure UI - just reports which mode is selected. Doesn't know or care
// about windows/scrolling at all, that's all owned by useChartWindows.
export default function ChartWindowToggle({ mode, setMode }) {
    return (
        <div className="chart-window-toggle">
            <button
                className={`toggle-btn ${mode === 'year' ? 'toggle-btn-active' : ''}`}
                onClick={() => setMode('year')}
            >
                Year
            </button>
            <button
                className={`toggle-btn ${mode === 'month' ? 'toggle-btn-active' : ''}`}
                onClick={() => setMode('month')}
            >
                Month
            </button>
        </div>
    );
}