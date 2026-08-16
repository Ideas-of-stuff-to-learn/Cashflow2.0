import { Text, View } from 'react-native';
import { styles } from '../../styles/homepageStyles.js';

export default function HomepageInfo({ dateRangeInfo, uploadCount, uploadBreakdown }) {
    const sessionCount = uploadBreakdown?.session_count ?? 0;
    const pastCount = uploadBreakdown?.past_count ?? uploadCount;

    return (
        <>
            <Text style={styles.title}>Transaction Categorizer</Text>
            <Text style={styles.importantMsg}>This app does NOT connect to banks, it is strictly CSV upload only</Text>
            <Text style={styles.subtitle}>Upload a CSV to get started</Text>

            <View style={styles.uploadStats}>
                <Text style={styles.rangeText}>Total files uploaded: {uploadCount}</Text>
                {sessionCount > 0 && (
                    <Text style={styles.rangeText}>This session: {sessionCount} · Previous: {pastCount}</Text>
                )}
            </View>

            {dateRangeInfo && (
                <Text style={styles.rangeText}>
                    Transactions from {dateRangeInfo.rangeText}
                    {dateRangeInfo.skippedMonthYears.length > 0
                        ? ` (skipped ${dateRangeInfo.skippedMonthYears.join(', ')})`
                        : ''}.
                </Text>
            )}
        </>
    );
}
