import '../../styles/chartStyles.css';

// Standard checkbox-list semantics now: selectedCategories genuinely
// CONTAINS every category currently visible - "All" is checked when
// it contains every one of availableCategories, unchecking any single
// category just removes it from the set, leaving everything else
// untouched. No more "empty set means show everything" special case.
export default function CategorySlicer({ availableCategories, selectedCategories, toggleCategory, toggleAllCategories, categoryColors }) {
    const allSelected = availableCategories.every(cat => selectedCategories.has(cat));

    return (
        <>
            <p className="slicer-label">Categories</p>
            <div className="chip-wrap">
                <button
                    className={`chip ${allSelected ? 'chip-active' : ''}`}
                    onClick={() => toggleAllCategories(availableCategories)}
                >
                    <span className={`chip-text ${allSelected ? 'chip-text-active' : ''}`}>All</span>
                </button>
                {availableCategories.map(cat => (
                    <button
                        key={cat}
                        className={`chip ${selectedCategories.has(cat) ? 'chip-active' : ''}`}
                        onClick={() => toggleCategory(cat)}
                    >
                        <span className="chip-colour-dot" style={{ backgroundColor: categoryColors?.[cat] || '#BBBBBB' }} />
                        <span className={`chip-text ${selectedCategories.has(cat) ? 'chip-text-active' : ''}`}>{cat}</span>
                    </button>
                ))}
            </div>
        </>
    );
}