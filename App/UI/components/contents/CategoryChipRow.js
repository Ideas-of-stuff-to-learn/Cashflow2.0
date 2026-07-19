import { ScrollView, TouchableOpacity, Text } from 'react-native';
import { styles } from '../../styles/contentsStyles.js';

export default function CategoryChipRow({ availableCategories, selectedCategories, onToggleCategory, onClearCategories }) {
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            <TouchableOpacity
                style={[styles.chip, selectedCategories.size === 0 && styles.chipActive]}
                onPress={onClearCategories}
            >
                <Text style={[styles.chipText, selectedCategories.size === 0 && styles.chipTextActive]}>
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
