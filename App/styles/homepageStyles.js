import { StyleSheet} from 'react-native';

export const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 20 },
    scrollView: { flex: 1, backgroundColor: '#fff' },
    scrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
    subtitle: { fontSize: 16, color: '#555', marginBottom: 24 },
    rangeText: { fontSize: 13, color: '#777', marginBottom: 20, textAlign: 'center' },
    button: { backgroundColor: '#2E5C8A', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, marginBottom: 12, width: '100%', alignItems: 'center' },
    secondaryButton: { backgroundColor: '#3D8B5F', marginTop: 12 },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    fileInfo: { backgroundColor: '#F0F4F8', padding: 16, borderRadius: 8, marginBottom: 12, width: '100%' },
    fileInfoText: { fontSize: 14, color: '#333', marginBottom: 4 },
    status: { fontSize: 14, color: '#2E5C8A', marginBottom: 8, fontStyle: 'italic', alignSelf: 'stretch' },
    error: { color: '#D94F4F', marginBottom: 12, fontSize: 14, alignSelf: 'stretch' },
    logoutButton: { backgroundColor: '#D94F4F', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, marginTop: 12, width: '100%', alignItems: 'center' },
    logoutText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});