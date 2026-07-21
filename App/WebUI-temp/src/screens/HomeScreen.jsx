import { Text, View, TouchableOpacity, Alert, ActivityIndicator, ScrollView} from 'react-native';
import { useApp } from '../AppContext';
import { useInitialLoadLogic } from '../customHooks/homescreen/useInitialLoadLogic';
import { useLogout } from '../customHooks/homescreen/useLogout';
import { useFilePicker } from '../customHooks/homescreen/useFilePicker';
import { useFileProcessor } from '../customHooks/homescreen/useFileProcessor';
import { NOT_YET_CATEGORISED } from '../checkingName';
import HomepageInfo from '../components/homepage/homepageInfo';
import { styles } from '../styles/homepageStyles';
export default function HomeScreen({ navigation }) {
    const {categorising, transactions, initialLoadError, retryInitialLoad, allTransactionsLoaded} = useApp();

    const {dateRangeInfo, uploadCount, refetchUploadCount} = useInitialLoadLogic();

    const {handleLogout} = useLogout();


    const {  pickFiles,
        selectedFiles,
        status,
        setStatus,
        error,
        setError} = useFilePicker();

    const {processFiles, loading} = useFileProcessor(setStatus,setError,selectedFiles)

    const notYetCategorisedCount = transactions.filter(t => t.category === NOT_YET_CATEGORISED).length;

    // Wraps processFiles so the displayed "past files uploaded" count
    // catches up immediately after a successful upload, instead of
    // sitting stale until the app is fully restarted.
    async function handleCategorisePress() {
        await processFiles();
        refetchUploadCount();
    }

    return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

        <HomepageInfo
            dateRangeInfo={dateRangeInfo}
            uploadCount={uploadCount}
        >
        </HomepageInfo>

        {/* Cold-start / initial load error - shown instead of (not
            alongside) the normal loading spinner when the very first
            fetch after app open timed out waiting for Render to wake up.
            Cleared automatically when retryInitialLoad re-runs the fetch. */}
        {initialLoadError && (
            <View style={styles.banner}>
                <Text style={styles.bannerText}>{initialLoadError}</Text>
                <TouchableOpacity
                    style={[styles.button, { marginTop: 8 }]}
                    onPress={retryInitialLoad}
                >
                    <Text style={styles.buttonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        )}

        {/* CSV file uploader */}
        <TouchableOpacity style={[styles.button, (loading || categorising) && styles.buttonDisabled]} onPress={pickFiles} disabled={loading || categorising}>
        <Text style={styles.buttonText}>Choose CSV Files</Text>
        </TouchableOpacity>

        {selectedFiles.length > 0 && (
            <View style={styles.fileInfo}>
                <Text style={styles.fileInfoText}>
                    Current file{selectedFiles.length > 1 ? 's' : ''}:
                </Text>
                {selectedFiles.map(f => (
                    <Text key={f.uri} style={styles.fileInfoText}>
                        {f.name} ({(f.size / 1024).toFixed(1)} KB)
                    </Text>
                ))}
            </View>
        )}
        {status && <Text style={styles.status}>{status}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}

        {/* Categorise - handles retrying anything left NOT_YET_CATEGORISED
            AND processing newly selected files, in that order (see
            processFiles in useFileProcessor.js). Disabled until
            allTransactionsLoaded - pressing this while transaction
            history is still streaming in could miss rows that hadn't
            arrived yet. Doesn't require a file to be selected if
            there's retry work waiting - a person with only failed
            transactions to retry shouldn't need to pick a file first. */}

        <TouchableOpacity
            style={[styles.button, styles.secondaryButton,
                (loading || !allTransactionsLoaded || (selectedFiles.length === 0 && notYetCategorisedCount === 0)) && styles.buttonDisabled]}
            onPress={handleCategorisePress}
            disabled={loading || categorising || !allTransactionsLoaded || (selectedFiles.length === 0 && notYetCategorisedCount === 0)}
        >
            {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>
                    {notYetCategorisedCount > 0
                        ? `Categorise${selectedFiles.length > 0 ? '' : ` (retry ${notYetCategorisedCount})`}`
                        : 'Categorise'}
                  </Text>
            }
        </TouchableOpacity>

        {/* Charts */}
        <TouchableOpacity
        style={[styles.button, styles.secondaryButton]}
        onPress={() => navigation.navigate('Charts')}
        >
        <Text style={styles.buttonText}>Go to Charts</Text>
        </TouchableOpacity>


        {/* Data displayed as a filtereable table with changing categories possible */}
        <TouchableOpacity
        style={[styles.button, styles.secondaryButton]}
        onPress={() => navigation.navigate('Contents')}
        >
        <Text style={styles.buttonText}>Go to CSV Contents</Text>
        </TouchableOpacity>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
    </ScrollView>
    );
}