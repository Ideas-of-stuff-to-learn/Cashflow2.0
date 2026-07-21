import { View, TouchableOpacity, Text } from 'react-native';
import { styles } from '../../styles/chartStyes';

export default function CategorySlicer({ availableCategories, selectedCategories, setSelectedCategories, toggleItem, selectAll }) {
    return (
        <>
            <Text style={styles.slicerLabel}>Categories</Text>
            <View style={styles.chipWrap}>
                <TouchableOpacity
                    style={[styles.chip, selectedCategories.size === 0 && styles.chipActive]}
                    onPress={() => selectAll(setSelectedCategories)}
                >
                    <Text style={[styles.chipText, selectedCategories.size === 0 && styles.chipTextActive]}>
                        All
                    </Text>
                </TouchableOpacity>
                {availableCategories.map(cat => (
                    <TouchableOpacity
                        key={cat}
                        style={[styles.chip, selectedCategories.has(cat) && styles.chipActive]}
                        onPress={() => toggleItem(selectedCategories, setSelectedCategories, cat)}
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