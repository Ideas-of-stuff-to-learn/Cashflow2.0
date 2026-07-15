import { Text, View, TouchableOpacity, Alert, ActivityIndicator} from 'react-native';
import { useApp } from '../AppContext.js';
import { useInitialLoadLogic } from '../customHooks/homescreen/useInitialLoadLogic.js';
import { useLogout } from '../customHooks/homescreen/useLogout.js';
import { useFilePicker } from '../customHooks/homescreen/useFilePicker.js';
import { useFileProcessor } from '../customHooks/homescreen/useFileProcessor.js';
import HomepageInfo from '../components/homepage/homepageInfo.js';
import { styles } from '../styles/homepageStyles.js';
export default function HomeScreen({ navigation }) {
    const {categorising} = useApp();

    const {dateRangeInfo} = useInitialLoadLogic();

    const {handleLogout} = useLogout();


    const {  pickFiles,
        selectedFiles,
        status,
        setStatus,
        error,
        setError} = useFilePicker();

    const {processFiles,loading} = useFileProcessor(setStatus,setError,selectedFiles)

    return (
    <View style={styles.container}>

        <HomepageInfo
            dateRangeInfo={dateRangeInfo}
        >
        </HomepageInfo>

        {/* CSV file uploader */}
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

        {/* Categorise */}

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
    </View>
    );
}

