import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';

export default function ManualReviewSequentialModal({
    item,
    remaining,
    categoryNames,
    onPick,
    flushing,
    flushError,
    isDone,
    onRetry,
    onDoneClose,
}) {
    if (!item && !flushing && !flushError && !isDone) return null;

    return (
        <Modal
            visible={true}
            transparent={true}
            animationType="slide"
            onRequestClose={() => {}}
        >
            <View style={styles.overlay}>
                <View style={styles.card}>
                    {isDone ? (
                        <View style={styles.doneContainer}>
                            <Text style={styles.doneText}>All done!</Text>
                            <Text style={styles.doneSubtext}>All transactions have been categorised.</Text>
                            <TouchableOpacity style={[styles.retryBtn, { marginTop: 24 }]} onPress={onDoneClose}>
                                <Text style={styles.retryBtnText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    ) : flushing ? (
                        <View style={styles.flushContainer}>
                            <ActivityIndicator size="large" color="#2E5C8A" />
                            <Text style={styles.flushText}>Saving your picks...</Text>
                        </View>
                    ) : flushError ? (
                        <View style={styles.flushContainer}>
                            <Text style={styles.errorText}>Failed to save — please try again.</Text>
                            <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
                                <Text style={styles.retryBtnText}>Retry</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <View style={styles.header}>
                                <Text style={styles.remaining}>{remaining} left</Text>
                            </View>
                            <Text style={styles.description} numberOfLines={3}>{item?.description}</Text>
                            <Text style={styles.meta}>
                                {item?.date}  ·  £{Math.abs(item?.amount || 0).toFixed(2)}
                            </Text>
                            <ScrollView style={styles.categoryList} showsVerticalScrollIndicator={false}>
                                {categoryNames.map(cat => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={styles.categoryBtn}
                                        onPress={() => onPick(cat)}
                                    >
                                        <Text style={styles.categoryBtnText}>{cat}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    card: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 24,
        maxHeight: '80%',
    },
    header: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 },
    remaining: { fontSize: 13, color: '#888', fontWeight: '600' },
    description: { fontSize: 17, fontWeight: '600', color: '#1a1a1a', marginBottom: 6 },
    meta: { fontSize: 13, color: '#888', marginBottom: 16 },
    categoryList: { maxHeight: 300 },
    categoryBtn: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        marginBottom: 8,
    },
    categoryBtnText: { fontSize: 15, color: '#1a1a1a' },
    flushContainer: { alignItems: 'center', paddingVertical: 32 },
    flushText: { marginTop: 16, fontSize: 15, color: '#555' },
    errorText: { fontSize: 15, color: '#D94F4F', marginBottom: 16, textAlign: 'center' },
    retryBtn: {
        backgroundColor: '#2E5C8A',
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 8,
    },
    retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    doneContainer: { alignItems: 'center', paddingVertical: 32 },
    doneText: { fontSize: 22, fontWeight: '700', color: '#3D8B5F', marginBottom: 8 },
    doneSubtext: { fontSize: 14, color: '#666', textAlign: 'center' },
});
