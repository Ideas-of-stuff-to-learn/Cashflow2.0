import { useState } from 'react';
import { Text, View } from 'react-native';
import { styles } from '../../styles/homepageStyles.js';
import UploadFilesPopup from './UploadFilesPopup.js';

export default function HomepageInfo({ dateRangeInfo, uploadBreakdown }) {
    const [openPopup, setOpenPopup] = useState(null);

    const sessionCount = uploadBreakdown?.session_count ?? 0;
    const pastCount = uploadBreakdown?.past_count ?? 0;
    const sessionFiles = uploadBreakdown?.session_files ?? [];
    const pastFiles = uploadBreakdown?.past_files ?? [];

    return (
        <>
            <Text style={styles.title}>Transaction Categorizer</Text>
            <Text style={styles.importantMsg}>This app does NOT connect to banks, it is strictly CSV upload only</Text>
            <Text style={styles.subtitle}>Upload a CSV to get started</Text>

            <View style={styles.uploadStats}>
                <UploadFilesPopup
                    label="Past files uploaded"
                    files={pastFiles}
                    count={pastCount}
                    isOpen={openPopup === 'past'}
                    onOpen={() => setOpenPopup('past')}
                    onClose={() => setOpenPopup(null)}
                />
                <UploadFilesPopup
                    label="Files uploaded this session"
                    files={sessionFiles}
                    count={sessionCount}
                    isOpen={openPopup === 'session'}
                    onOpen={() => setOpenPopup('session')}
                    onClose={() => setOpenPopup(null)}
                />
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
