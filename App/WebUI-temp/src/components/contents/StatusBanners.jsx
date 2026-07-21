import { View, Text, TouchableOpacity } from 'react-native';
import { styles } from '../../styles/contentsStyles';

export default function StatusBanners({
    outOfSyncMessage,
    initialLoading,
    initialLoadError,
    onRetry,
    categorising,
}) {
    return (
        <>
            {outOfSyncMessage && (
                <View style={styles.outOfSyncBanner}>
                    <Text style={styles.outOfSyncBannerText}>
                        ⚠️ {outOfSyncMessage}
                    </Text>
                </View>
            )}

            {initialLoading && (
                <View style={styles.banner}>
                    {initialLoadError ? (
                        <>
                            <Text style={styles.bannerText}>{initialLoadError}</Text>
                            <TouchableOpacity style={[styles.button, { marginTop: 8 }]} onPress={onRetry}>
                                <Text style={styles.buttonText}>Retry</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <Text style={styles.bannerText}>⏳ Loading your data...</Text>
                    )}
                </View>
            )}

            {categorising && (
                <View style={styles.banner}>
                    <Text style={styles.bannerText}>
                        ⏳ Categorising in background...
                    </Text>
                </View>
            )}
        </>
    );
}
