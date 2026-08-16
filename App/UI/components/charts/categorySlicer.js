import { View, TouchableOpacity, Text } from 'react-native';
import { styles } from '../../styles/chartStyes.js';

export default function CategorySlicer({ availableCategories, selectedCategories, toggleItem, selectAll }) {
    const allSelected = selectedCategories.size === availableCategories.length && availableCategories.length > 0;
    return (
        <>
            <Text style={styles.slicerLabel}>Categories</Text>
            <View style={styles.chipWrap}>
                <TouchableOpacity
                    style={[styles.chip, allSelected && styles.chipActive]}
                    onPress={selectAll}
                >
                    <Text style={[styles.chipText, allSelected && styles.chipTextActive]}>
                        All
                    </Text>
                </TouchableOpacity>
                {availableCategories.map(cat => (
                    <TouchableOpacity
                        key={cat}
                        style={[styles.chip, selectedCategories.has(cat) && styles.chipActive]}
                        onPress={() => toggleItem(cat)}
                    >
                        <Text style={[styles.chipText, selectedCategories.has(cat) && styles.chipTextActive]}>
                            {cat}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </>
    );
}