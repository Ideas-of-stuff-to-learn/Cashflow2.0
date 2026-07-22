import '../../styles/chartStyles.css';

export default function MonthSlicer({ months, selectedMonths, setSelectedMonths, toggleItem, selectAll }) {
    return (
        <>
            <p className="slicer-label">Months</p>
            <div className="chip-row">
                <button
                    className={`chip ${selectedMonths.size === 0 ? 'chip-active' : ''}`}
                    onClick={() => selectAll(setSelectedMonths)}
                >
                    <span className={`chip-text ${selectedMonths.size === 0 ? 'chip-text-active' : ''}`}>All</span>
                </button>
                {months.map(month => (
                    <button
                        key={month}
                        className={`chip ${selectedMonths.has(month) ? 'chip-active' : ''}`}
                        onClick={() => toggleItem(selectedMonths, setSelectedMonths, month)}
                    >
                        <span className={`chip-text ${selectedMonths.has(month) ? 'chip-text-active' : ''}`}>{month}</span>
                    </button>
                ))}
            </div>
        </>
    );
}