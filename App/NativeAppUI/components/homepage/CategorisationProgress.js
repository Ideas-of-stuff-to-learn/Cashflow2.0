import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function CategorisationProgress({ status, progress, processingStage }) {
    const [minimised, setMinimised] = useState(false);

    const isActive = processingStage === 'parsing' || processingStage === 'checkingCache' || processingStage === 'waitingForLLM';
    if (!isActive && !status) return null;

    const phaseLabel = {
        parsing: 'Parsing CSV',
        checkingCache: 'Checking cache',
        waitingForLLM: 'Categorising with AI',
        done: 'Done',
    }[processingStage] || '';

    const hasProgress = progress && progress.total > 0;
    const pct = hasProgress ? Math.round((progress.current / progress.total) * 100) : 0;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.phase}>{phaseLabel}</Text>
                <TouchableOpacity onPress={() => setMinimised(m => !m)} style={styles.minimiseBtn}>
                    <Text style={styles.minimiseBtnText}>{minimised ? '▲' : '▼'}</Text>
                </TouchableOpacity>
            </View>

            {!minimised && (
                <>
                    {hasProgress && (
                        <View style={styles.progressRow}>
                            <View style={styles.progressTrack}>
                                <View style={[styles.progressFill, { width: `${pct}%` }]} />
                            </View>
                            <Text style={styles.progressPct}>{pct}%</Text>
                        </View>
                    )}
                    {status ? <Text style={styles.statusText}>{status}</Text> : null}
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#EAF2FB',
        borderRadius: 10,
        padding: 14,
        marginBottom: 12,
        width: '100%',
        borderLeftWidth: 3,
        borderLeftColor: '#2E5C8A',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    phase: { fontSize: 14, fontWeight: '600', color: '#2E5C8A', flexShrink: 1 },
    minimiseBtn: { paddingHorizontal: 8, paddingVertical: 2 },
    minimiseBtnText: { fontSize: 12, color: '#2E5C8A' },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        gap: 8,
    },
    progressTrack: {
        flex: 1,
        height: 6,
        backgroundColor: '#c8ddf0',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#2E5C8A',
        borderRadius: 3,
    },
    progressPct: { fontSize: 12, color: '#2E5C8A', fontWeight: '600', minWidth: 34, textAlign: 'right' },
    statusText: { fontSize: 13, color: '#444', marginTop: 8, fontStyle: 'italic' },
});
