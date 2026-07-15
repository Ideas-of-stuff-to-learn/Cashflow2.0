import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useState, useEffect, useMemo } from 'react';
import {File} from 'expo-file-system';
import { logout, parseCSVFiles, categorizeTransactions, categorizeCached, categorizeLLM, getTransactionHistory, getCategories } from '../api.js';
import { useApp } from '../AppContext.js';

// Parses this app's stored DD/MM/YYYY date strings into real Date
// objects and finds the earliest/latest across every currently-loaded
// transaction, formatted as a readable "Month Year" range. For any row
// whose full date doesn't parse cleanly, still tries to salvage just
// the month/year portion (day can be garbage but month/year often
// still readable) so those can be listed by name rather than just
// counted. Returns null if there's no valid date data yet.
function getDateRangeInfo(transactions) {
    if (!transactions || transactions.length === 0) return null;

    let earliest = null;
    let latest = null;
    const skippedMonthYears = new Set();

    for (const t of transactions) {
        if (!t.date) continue;
        const [dd, mm, yyyy] = t.date.split('/');
        const d = new Date(yyyy, mm - 1, dd);

        if (isNaN(d.getTime())) {
            const monthNum = parseInt(mm, 10);
            const yearNum = parseInt(yyyy, 10);
            if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12 && !isNaN(yearNum)) {
                const label = new Date(yearNum, monthNum - 1, 1)
                    .toLocaleString('default', { month: 'long', year: 'numeric' });
                skippedMonthYears.add(label);
            }
            continue;
        }

        if (!earliest || d < earliest) earliest = d;
        if (!latest || d > latest) latest = d;
    }

    if (!earliest || !latest) return null;

    const format = (d) => d.toLocaleString('default', { month: 'long', year: 'numeric' });
    return {
        rangeText: `${format(earliest)} – ${format(latest)}`,
        skippedMonthYears: Array.from(skippedMonthYears),
    };
}

export default function HomeScreen({ navigation }) {
    const {
        transactions,
        setTransactions,
        setCategorising,
        categorising,
        setCategories,
        setInitialLoading,
        setProcessingStage
    } = useApp();

    const dateRangeInfo = useMemo(() => getDateRangeInfo(transactions), [transactions]);

    useEffect(() => {
        let cancelled = false;
        async function loadInitialData() {
            try {
                // Fetch in parallel - unrelated data, no reason to wait
                // on one before starting the other
                const [history, cats] = await Promise.all([
                    getTransactionHistory(),
                    getCategories(),
                ]);
                if (!cancelled) {
                    setTransactions(history);
                    setCategories(cats);
                }
            } catch (e) {
                // Not fatal - user can still upload fresh, just starts
                // from empty instead of restored history/categories
                console.warn('Failed to load initial data:', e.message);
            } finally {
                if (!cancelled) {
                    setInitialLoading(false);
                }
            }
        }
        loadInitialData();
        return () => { cancelled = true; };
    }, []);

    const handleLogout = () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to log out?",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Logout", 
                    style: "destructive",
                    onPress: async () => {
                        // 1. Clear any local states, auth headers, or tokens here if you are storing them 
                        // (e.g., AsyncStorage.clear() or resetting a state manager)
                        await logout();
                        // 2. Clear the navigation stack and force-route back to Login
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Login' }],
                        });
                    }
                }
            ]
        );
    };
    const [csvContents, setCsvContents] = useState(null);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);
    const [error, setError] = useState(null);

    async function pickFiles() {
        const result = await DocumentPicker.getDocumentAsync({
            type: '*/*',
            copyToCacheDirectory: true,
            multiple: true,
        });

        if (result.canceled) {
            return;
        }

        const csvFiles = result.assets.filter(f =>
            f.name.toLowerCase().endsWith('.csv')
        );

        if (csvFiles.length === 0) {
            setError('Please choose at least one .csv file');
            return;
        }

        setSelectedFiles(csvFiles);
        setError(null);
        setStatus(`${csvFiles.length} file(s) selected`);
    }

     // Merges freshly parsed/categorized rows into whatever's already
     // loaded (history from mount, or earlier uploads this session),
     // matching by id - real database ids now (from parse_csv), so a
     // transaction that already exists just gets its entry updated in
     // place rather than duplicated, and unrelated existing rows are
     // left untouched instead of being wiped out.
     function mergeById(prev, incoming) {
        const byId = new Map(prev.map(t => [t.id, t]));
        for (const t of incoming) {
            byId.set(t.id, t);
        }
        return Array.from(byId.values());
     }

     async function processFiles() {
        if (selectedFiles.length === 0) {
            setError('Please select files first');
            return;
        }

        setLoading(true);
        setError(null);
        setProcessingStage('parsing');

        try {
            // Phase 1: Parse CSV files - fast, no LLM
            setStatus('Parsing CSV files...');
            const parsed = await parseCSVFiles(selectedFiles);

            // Merge into existing state (history + any prior uploads
            // this session) rather than replacing it outright. parsed
            // now carries the real category for any row that already
            // existed (a re-upload), so this shows the correct category
            // immediately with no flicker.
            setTransactions(prev => mergeById(prev, parsed));
            setCategorising(true);

            // Navigate immediately - user can see the table now
            navigation.navigate('Contents');

            // Only genuinely new rows need to go through cache tiers /
            // LLM at all - anything already fully known (a re-upload of
            // an already-categorized transaction) skips this entirely,
            // since there's nothing left to resolve for it.
            const needsCategorization = parsed.filter(t => t.category == null);

            if (needsCategorization.length > 0) {
                setStatus('Checking cache...');
                setProcessingStage('checkingCache');
                const phase1 = await categorizeCached(needsCategorization);

                setTransactions(prev => mergeById(prev, phase1));
                setProcessingStage('waitingForLLM');
                setCategorising(true);
                // Phase 2: Categorise in background - may take a while
                // Navigation has already happened, this continues running
                const pendingItems = phase1.filter(t => t.category === 'PENDING_LLM');
                if (pendingItems.length > 0) {
                    setStatus(`Categorising ${pendingItems.length} new transactions...`);
                    const phase2 = await categorizeLLM(pendingItems);

                    // Merge phase2 results back into phase1
                    // Match by description since same description = same category
                    const phase2ByDescription = {};
                    for (const t of phase2) {
                        phase2ByDescription[t.description] = t.category;
                    }

                    const merged = phase1.map(t => {
                        if (t.category !== 'PENDING_LLM') return t;
                        const resolvedCategory = phase2ByDescription[t.description];
                        return resolvedCategory
                            ? { ...t, category: resolvedCategory }
                            : t;
                    });

                    setTransactions(prev => mergeById(prev, merged));
                    setProcessingStage('done');
                }
            }

        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
            setStatus(null);
            setCategorising(false);
            setProcessingStage(prev =>
                prev === 'done' ? 'done' : 'idle'
            );
        }
    }
    return (
    <View style={styles.container}>
        <Text style={styles.title}>Transaction Categorizer</Text>
        <Text style={styles.importantMsg}>This app does NOT connect to banks, it is strictly CSV upload only</Text>
        <Text style={styles.subtitle}>Upload a CSV to get started</Text>
        {dateRangeInfo && (
            <Text style={styles.rangeText}>
                You've uploaded transactions from {dateRangeInfo.rangeText} so far
                {dateRangeInfo.skippedMonthYears.length > 0
                    ? ` (skipped ${dateRangeInfo.skippedMonthYears.join(', ')})`
                    : ''}.
            </Text>
        )}

        <TouchableOpacity style={[styles.button, (loading || categorising) && styles.buttonDisabled]} onPress={pickFiles} disabled={loading || categorising}>
        <Text style={styles.buttonText}>Choose CSV Files</Text>
        </TouchableOpacity>

        {selectedFiles.length > 0 && (
            <View style={styles.fileInfo}>
                {selectedFiles.map(f => (
                    <Text key={f.uri} style={styles.fileInfoText}>
                        {f.name} ({(f.size / 1024).toFixed(1)} KB)
                    </Text>
                ))}
            </View>
        )}
        {status && <Text style={styles.status}>{status}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
            style={[styles.button, styles.secondaryButton,
                (loading || selectedFiles.length === 0) && styles.buttonDisabled]}
            onPress={processFiles}
            disabled={loading || selectedFiles.length === 0 || categorising}
        >
            {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>Categorise</Text>
            }
        </TouchableOpacity>

        <TouchableOpacity
        style={[styles.button, styles.secondaryButton]}
        onPress={() => navigation.navigate('Charts', { csvContents })}
        >
        <Text style={styles.buttonText}>Go to Charts</Text>
        </TouchableOpacity>
        <TouchableOpacity
        style={[styles.button, styles.secondaryButton]}
        onPress={() => navigation.navigate('Contents', { csvContents })}
        >
        <Text style={styles.buttonText}>Go to CSV Contents</Text>
        </TouchableOpacity>
        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
    </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
    subtitle: { fontSize: 16, color: '#555', marginBottom: 24 },
    rangeText: { fontSize: 13, color: '#777', marginBottom: 20, textAlign: 'center' },
    button: { backgroundColor: '#2E5C8A', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, marginBottom: 12, width: '100%', alignItems: 'center' },
    secondaryButton: { backgroundColor: '#3D8B5F', marginTop: 12 },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    fileInfo: { backgroundColor: '#F0F4F8', padding: 16, borderRadius: 8, marginBottom: 12, width: '100%' },
    fileInfoText: { fontSize: 14, color: '#333', marginBottom: 4 },
    status: { fontSize: 14, color: '#2E5C8A', marginBottom: 8, fontStyle: 'italic' },
    error: { color: '#D94F4F', marginBottom: 12, fontSize: 14 },
    logoutButton: { backgroundColor: '#D94F4F', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, marginTop: 12, width: '100%', alignItems: 'center' },
    logoutText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});