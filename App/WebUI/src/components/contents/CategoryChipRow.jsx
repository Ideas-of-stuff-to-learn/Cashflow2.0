import '../../styles/contentsStyles.css';

export default function CategoryChipRow({ availableCategories, selectedCategories, onToggleCategory, onToggleAllCategories, categoryColors }) {
    const allSelected = availableCategories.every(cat => selectedCategories.has(cat));

    return (
        <div className="chip-row">
            <button
                className={`chip ${allSelected ? 'chip-active' : ''}`}
                onClick={onToggleAllCategories}
            >
                <span className={`chip-text ${allSelected ? 'chip-text-active' : ''}`}>All</span>
            </button>
            {availableCategories.map(cat => (
                <button
                    key={cat}
                    className={`chip ${selectedCategories.has(cat) ? 'chip-active' : ''}`}
                    onClick={() => onToggleCategory(cat)}
                >
                    <span className="chip-colour-dot" style={{ backgroundColor: categoryColors?.[cat] || '#BBBBBB' }} />
                    <span className={`chip-text ${selectedCategories.has(cat) ? 'chip-text-active' : ''}`}>{cat}</span>
                </button>
            ))}
        </div>
    );
}