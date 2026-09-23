import { ScrollView, TouchableOpacity, Text } from 'react-native';
import { styles } from '../../styles/contentsStyles.js';

export default function CategoryChipRow({ availableCategories, selectedCategories, onToggleCategory, onToggleAllCategories }) {
    const allSelected = selectedCategories.size === availableCategories.length && availableCategories.length > 0;
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            <TouchableOpacity
                style={[styles.chip, allSelected && styles.chipActive]}
                onPress={onToggleAllCategories}
            >
                <Text style={[styles.chipText, allSelected && styles.chipTextActive]}>
                    All
                </Text>
            </TouchableOpacity>
            {availableCategories.map(cat => (
                <TouchableOpacity
                    key={cat}
                    style={[styles.chip, selectedCategories.has(cat) && styles.chipActive]}
                    onPress={() => onToggleCategory(cat)}
                >
                    <Text style={[styles.chipText, selectedCategories.has(cat) && styles.chipTextActive]}>
                        {cat}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );
}
