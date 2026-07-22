import '../../styles/contentsStyles.css';
import { ROW_HEIGHT } from '../../utils/contentsscreen/contentsUtils';

export default function CategoryChipRow({ availableCategories, selectedCategories, onToggleCategory, onClearCategories }) {
    return (
        <div className="chip-row">
            <button
                className={`chip ${selectedCategories.size === 0 ? 'chip-active' : ''}`}
                onClick={onClearCategories}
            >
                <span className={`chip-text ${selectedCategories.size === 0 ? 'chip-text-active' : ''}`}>
                    All
                </span>
            </button>
            {availableCategories.map(cat => (
                <button
                    key={cat}
                    className={`chip ${selectedCategories.has(cat) ? 'chip-active' : ''}`}
                    onClick={() => onToggleCategory(cat)}
                >
                    <span className={`chip-text ${selectedCategories.has(cat) ? 'chip-text-active' : ''}`}>
                        {cat}
                    </span>
                </button>
            ))}
        </div>
    );
}