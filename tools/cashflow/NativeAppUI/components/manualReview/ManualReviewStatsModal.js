import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';

export default function ManualReviewStatsModal({ flow, onContinue, onPutAllInOther }) {
    if (!flow || flow.stage !== 'stats') return null;

    return (
        <Modal
            visible={true}
            transparent={true}
            animationType="fade"
            onRequestClose={() => {}}
        >
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <Text style={styles.title}>Categorisation Complete</Text>
                    <Text style={styles.stat}>
                        {flow.autoResolvedCount} of {flow.totalTransactions} transactions auto-categorised
                    </Text>
                    <Text style={styles.reviewCount}>
                        {flow.needsReviewCount} need{flow.needsReviewCount === 1 ? 's' : ''} manual review
                    </Text>
                    <Text style={styles.body}>
                        These couldn't be categorised automatically. You can review them one by one, or put them all in "Other" now.
                    </Text>

                    <TouchableOpacity style={styles.primaryBtn} onPress={onContinue}>
                        <Text style={styles.primaryBtnText}>Review ({flow.needsReviewCount})</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.secondaryBtn} onPress={onPutAllInOther}>
                        <Text style={styles.secondaryBtnText}>Put all in Other</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 24,
        width: '100%',
        maxWidth: 400,
    },
    title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
    stat: { fontSize: 15, color: '#555', marginBottom: 4 },
    reviewCount: { fontSize: 18, fontWeight: '600', color: '#2E5C8A', marginBottom: 12 },
    body: { fontSize: 14, color: '#666', marginBottom: 24, lineHeight: 20 },
    primaryBtn: {
        backgroundColor: '#2E5C8A',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 10,
    },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    secondaryBtn: {
        backgroundColor: '#f0f0f0',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    secondaryBtnText: { color: '#333', fontSize: 16, fontWeight: '500' },
});
