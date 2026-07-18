import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    colourChip: {
        flexDirection: 'row', alignItems: 'center',
        borderWidth: 1.5, borderRadius: 16,
        paddingVertical: 4, paddingHorizontal: 10,
        marginRight: 6, marginBottom: 6,
    },
    colourDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
    dropdownToggle: {
        backgroundColor: '#2E5C8A', borderRadius: 8,
        paddingVertical: 10, paddingHorizontal: 14,
        marginTop: 4, marginBottom: 8, alignItems: 'center',
    },
    dropdownToggleDisabled: { opacity: 0.5 },
    dropdownToggleText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    swatchGrid: {
        flexDirection: 'row', flexWrap: 'wrap',
        marginBottom: 16, padding: 8,
        backgroundColor: '#F0F4F8', borderRadius: 8,
    },
    swatch: {
        width: 40, height: 40, borderRadius: 20,
        margin: 6,
        borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)',
    },
    emptyText: { fontSize: 14, color: '#888', textAlign: 'center', marginVertical: 24 },
    banner: { backgroundColor: '#FFF3CD', padding: 8, borderRadius: 6, marginBottom: 8 },
    bannerText: { color: '#856404', fontSize: 13, textAlign: 'center' },
  slicerLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 16, marginBottom: 6 },
  chipRow: { flexDirection: 'row', marginBottom: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: '#2E5C8A', borderRadius: 16, paddingVertical: 4, paddingHorizontal: 12, marginRight: 6, marginBottom: 6 },
  chipActive: { backgroundColor: '#2E5C8A' },
  chipText: { fontSize: 12, color: '#2E5C8A' },
  chipTextActive: { color: '#fff' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionLabel: { fontSize: 14, color: '#555', marginBottom: 4 },
  container: { flex: 1, backgroundColor: '#fff'},
  title: { fontSize: 24, fontWeight: 'bold', marginTop: 24, marginBottom: 8 },
  scrollArea: { flex: 1, backgroundColor: '#F0F4F8', borderRadius: 8, padding: 12, marginBottom: 16 },
  csvText: { fontSize: 12, fontFamily: 'monospace', color: '#333'},
  subtitle: { fontSize: 16, color: '#555', marginBottom: 24 },
  button: { backgroundColor: '#2E5C8A', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, alignItems: 'center',  marginBottom: 24 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  tappedValueText: { fontSize: 16, fontWeight: '600', marginTop: 8, marginBottom: 16 },
});

