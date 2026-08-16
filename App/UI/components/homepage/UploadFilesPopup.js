import { Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback, ScrollView, StyleSheet } from 'react-native';

export default function UploadFilesPopup({ label, files, count, isOpen, onOpen, onClose }) {
    return (
        <>
            <TouchableOpacity onPress={onOpen}>
                <Text style={styles.trigger}>{label}: {count}</Text>
            </TouchableOpacity>

            <Modal
                visible={isOpen}
                transparent
                animationType="fade"
                onRequestClose={onClose}
            >
                <View style={styles.backdrop}>
                    <TouchableWithoutFeedback onPress={onClose}>
                        <View style={StyleSheet.absoluteFill} />
                    </TouchableWithoutFeedback>
                    <View style={styles.box}>
                        {files.length === 0 ? (
                            <Text style={styles.empty}>No files here yet.</Text>
                        ) : (
                            <ScrollView>
                                {files.map((f, i) => (
                                    <Text key={i} style={styles.item}>{f.filename}</Text>
                                ))}
                            </ScrollView>
                        )}
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Text style={styles.closeText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    trigger: {
        textDecorationLine: 'underline',
        textDecorationStyle: 'dotted',
        fontSize: 14,
        marginVertical: 2,
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        position: 'relative',
    },
    box: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 16,
        width: '100%',
        maxHeight: 300,
    },
    empty: {
        color: '#666',
        fontSize: 14,
    },
    item: {
        fontSize: 14,
        paddingVertical: 4,
        color: '#222',
    },
    closeBtn: {
        marginTop: 12,
        alignSelf: 'flex-end',
    },
    closeText: {
        color: '#2E5C8A',
        fontWeight: '600',
    },
});
