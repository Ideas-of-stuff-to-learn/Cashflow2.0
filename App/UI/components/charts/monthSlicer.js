import { ScrollView, TouchableOpacity, Text } from 'react-native';
import { styles } from '../../styles/chartStyes.js';

export default function MonthSlicer({ months, selectedMonths, setSelectedMonths, toggleItem, selectAll }) {
    return (
        <>
            <Text style={styles.slicerLabel}>Months</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                <TouchableOpacity
                    style={[styles.chip, selectedMonths.size === 0 && styles.chipActive]}
                    onPress={() => selectAll(setSelectedMonths)}
                >
                    <Text style={[styles.chipText, selectedMonths.size === 0 && styles.chipTextActive]}>
                        All
                    </Text>
                </TouchableOpacity>
                {months.map(month => (
                    <TouchableOpacity
                        key={month}
                        style={[styles.chip, selectedMonths.has(month) && styles.chipActive]}
                        onPress={() => toggleItem(selectedMonths, setSelectedMonths, month)}
                    >
                        <Text style={[styles.chipText, selectedMonths.has(month) && styles.chipTextActive]}>
                            {month}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </>
    );
}