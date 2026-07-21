import { Modal, Pressable, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { styles } from '../../styles/contentsStyles';

export default function CategoryResolveModal({
    reviewItem,
    bulkPickerVisible,
    selectedCount,
    manualReviewCount,
    selectableCategories,
    onPickCategory,
    onClose,
}) {
    return (
        <Modal
            visible={!!reviewItem || bulkPickerVisible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.modalBackdrop} onPress={onClose}>
                <Pressable style={styles.modalCard} onPress={() => {}}>
                    <View style={styles.modalTitleRow}>
                        <Text style={styles.modalTitle}>
                            {bulkPickerVisible
                                ? `Categorise ${selectedCount} transaction${selectedCount === 1 ? '' : 's'}`
                                : 'Categorise this transaction'}
                        </Text>
                        {manualReviewCount > 0 && (
                            <Text style={styles.modalRemainingCount}>
                                {manualReviewCount} left
                            </Text>
                        )}
                    </View>
                    {!bulkPickerVisible && reviewItem && (
                        <>
                            <Text style={styles.modalDesc}>{reviewItem.description}</Text>
                            <Text style={styles.modalAmount}>
                                £{Math.abs(reviewItem.amount || 0).toFixed(2)} · {reviewItem.date}
                            </Text>
                        </>
                    )}
                    <ScrollView style={styles.modalList}>
                        {selectableCategories.map(cat => (
                            <TouchableOpacity
                                key={cat}
                                style={styles.modalOption}
                                onPress={() => onPickCategory(cat)}
                            >
                                <Text style={styles.modalOptionText}>{cat}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
