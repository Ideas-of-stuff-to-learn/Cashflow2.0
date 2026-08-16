import { Text, View, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useApp } from '../AppContext.js';
import { useInitialLoadLogic } from '../customHooks/homescreen/useInitialLoadLogic.js';
import { useLogout } from '../customHooks/homescreen/useLogout.js';
import { useFilePicker } from '../customHooks/homescreen/useFilePicker.js';
import { useFileProcessor } from '../customHooks/homescreen/useFileProcessor.js';
import { NOT_YET_CATEGORISED } from '../../shared/checkingName.js';
import HomepageInfo from '../components/homepage/homepageInfo.js';
import CategorisationProgress from '../components/homepage/CategorisationProgress.js';
import { styles } from '../styles/homepageStyles.js';

export default function HomeScreen({ navigation }) {
    const { categorising, transactions, initialLoadError, retryInitialLoad, allTransactionsLoaded, processingStage, uploadBreakdown } = useApp();

    const { dateRangeInfo, uploadCount, refetchUploadCount } = useInitialLoadLogic();
    const { handleLogout } = useLogout();

    const { pickFiles, selectedFiles, status, setStatus, error, setError } = useFilePicker();
    const { processFiles, loading, progress } = useFileProcessor(setStatus, setError, selectedFiles);

    const notYetCategorisedCount = transactions.filter(t => t.category === NOT_YET_CATEGORISED).length;

    async function handleCategorisePress() {
        await processFiles();
        refetchUploadCount();
    }

    return (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <HomepageInfo
                dateRangeInfo={dateRangeInfo}
                uploadCount={uploadCount}
                uploadBreakdown={uploadBreakdown}
            />

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

            <CategorisationProgress
                status={status}
                progress={progress}
                processingStage={processingStage}
            />

            <TouchableOpacity
                style={[styles.button, (loading || categorising) && styles.buttonDisabled]}
                onPress={pickFiles}
                disabled={loading || categorising}
            >
                <Text style={styles.buttonText}>Choose CSV or Excel Files</Text>
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

            {error && <Text style={styles.error}>{error}</Text>}

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
                            ? `Automatically categorise (retry ${notYetCategorisedCount})`
                            : 'Automatically categorise'}
                      </Text>
                }
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={() => navigation.navigate('Charts')}
            >
                <Text style={styles.buttonText}>Go to Charts</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={() => navigation.navigate('Contents')}
            >
                <Text style={styles.buttonText}>Go to Transactions</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}
