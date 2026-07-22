import '../../styles/chartStyles.css';

export default function CategorySlicer({ availableCategories, selectedCategories, setSelectedCategories, toggleItem, selectAll }) {
    return (
        <>
            <p className="slicer-label">Categories</p>
            <div className="chip-wrap">
                <button
                    className={`chip ${selectedCategories.size === 0 ? 'chip-active' : ''}`}
                    onClick={() => selectAll(setSelectedCategories)}
                >
                    <span className={`chip-text ${selectedCategories.size === 0 ? 'chip-text-active' : ''}`}>All</span>
                </button>
                {availableCategories.map(cat => (
                    <button
                        key={cat}
                        className={`chip ${selectedCategories.has(cat) ? 'chip-active' : ''}`}
                        onClick={() => toggleItem(selectedCategories, setSelectedCategories, cat)}
                    >
                        <span className={`chip-text ${selectedCategories.has(cat) ? 'chip-text-active' : ''}`}>{cat}</span>
                    </button>
                ))}
            </div>
        </>
    );
}