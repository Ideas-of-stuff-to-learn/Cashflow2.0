import {Text } from 'react-native';
import { styles } from '../../styles/homepageStyles.js';

export default function HomepageInfo({ dateRangeInfo }) {
    return (
        <>
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
        </>
    );
}