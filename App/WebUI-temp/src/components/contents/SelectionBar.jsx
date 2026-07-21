import { View, Text, TouchableOpacity } from 'react-native';
import { styles } from '../../styles/contentsStyles';

export default function SelectionBar({
    selectedCount,
    onCancel,
    onSelectAll,
    onDeselectAll,
    onChangeCategory,
    onDelete,
    deleting,
}) {
    return (
        <View style={styles.selectionBar}>
            <View style={styles.selectionTopRow}>
                <Text style={styles.selectionText}>{selectedCount} selected</Text>
                <TouchableOpacity style={styles.selectionButton} onPress={onCancel}>
                    <Text style={styles.selectionButtonText}>Cancel</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.selectionBottomRow}>
                <TouchableOpacity style={styles.selectionButtonSmall} onPress={onSelectAll}>
                    <Text style={styles.selectionButtonTextSmall}>Select All</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.selectionButtonSmall} onPress={onDeselectAll}>
                    <Text style={styles.selectionButtonTextSmall}>Deselect All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.selectionButtonSmall, styles.selectionButtonPrimary, selectedCount === 0 && styles.selectionButtonDisabled]}
                    onPress={onChangeCategory}
                    disabled={selectedCount === 0}
                >
                    <Text style={styles.selectionButtonTextPrimary}>Change category</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.selectionButtonSmall, styles.selectionButtonDanger, (selectedCount === 0 || deleting) && styles.selectionButtonDisabled]}
                    onPress={onDelete}
                    disabled={selectedCount === 0 || deleting}
                >
                    <Text style={styles.selectionButtonTextDanger}>Delete</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
