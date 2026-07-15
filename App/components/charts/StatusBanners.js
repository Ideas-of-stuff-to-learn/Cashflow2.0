import { View, Text } from 'react-native';
import { styles } from '../../styles/chartStyes.js';

export default function StatusBanners({ initialLoading, processingStage }) {
    return (
        <>
            {initialLoading && (
                <View style={styles.banner}>
                    <Text style={styles.bannerText}>⏳ Loading your data...</Text>
                </View>
            )}
            {processingStage === 'checkingCache' && (
                <View style={styles.banner}>
                    <Text style={styles.bannerText}>
                        📊 Dummy data - checking previous categorisations...
                    </Text>
                </View>
            )}
            {processingStage === 'waitingForLLM' && (
                <View style={styles.banner}>
                    <Text style={styles.bannerText}>
                        ✓ Cached data loaded - finishing categorisation...
                    </Text>
                </View>
            )}
            {processingStage === 'parsing' && (
                <View style={styles.banner}>
                    <Text style={styles.bannerText}>
                        ⏳ Preparing your transactions...
                    </Text>
                </View>
            )}
        </>
    );
}