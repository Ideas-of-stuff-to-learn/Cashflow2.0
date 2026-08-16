import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import SpendingStackChart from './SpendingStackedChart.js';

export default function ChartWindowSection({
    ready, hasData,
    monthWindow, yearWindowEntries,
    scrollMonthWindow, scrollYearWindow, jumpMonthWindowToYear,
    canScrollMonthBack, canScrollMonthForward,
    canScrollYearBack, canScrollYearForward,
    buildStackDataFromEntries,
    incomeForEntries,
}) {
    const [mode, setMode] = useState('month');
    const [activeSegment, setActiveSegment] = useState(null);

    if (!ready || !hasData) return null;

    function handleSegmentPress(seg) {
        setActiveSegment(seg);
        if (mode === 'year' && jumpMonthWindowToYear) jumpMonthWindowToYear(seg.year);
    }

    const activeEntries = mode === 'year' ? yearWindowEntries : monthWindow;

    // Wrap buildStackDataFromEntries to intercept segment presses
    function buildWithPopup(entries, extraOnPress) {
        const data = buildStackDataFromEntries(entries, extraOnPress);
        // Patch each segment's onPress to also open our popup
        return data.map(bar => ({
            ...bar,
            stacks: bar.stacks.map(seg => ({
                ...seg,
                onPress: () => {
                    const original = seg.onPress;
                    if (original) original();
                    handleSegmentPress({ year: seg.year, month: seg.month, category: seg.category, value: seg.realValue });
                },
            })),
        }));
    }

    const stackData = buildWithPopup(activeEntries, mode === 'year' ? jumpMonthWindowToYear : null);
    const incomeData = incomeForEntries(activeEntries);

    const canGoBack = mode === 'year' ? canScrollYearBack : canScrollMonthBack;
    const canGoForward = mode === 'year' ? canScrollYearForward : canScrollMonthForward;

    function handleScroll(direction) {
        if (mode === 'year') scrollYearWindow(direction);
        else scrollMonthWindow(direction);
    }

    const segmentLabel = activeSegment
        ? activeSegment.month
            ? `${activeSegment.year}/${String(activeSegment.month).padStart(2,'0')} — ${activeSegment.category}: £${(activeSegment.value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
            : `${activeSegment.year} — ${activeSegment.category}: £${(activeSegment.value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : null;

    return (
        <View>
            {/* Header row: label left, toggles right */}
            <View style={styles.headerRow}>
                <Text style={styles.sectionLabel}>
                    {mode === 'year' ? 'Spending by year' : 'Spending by month'}
                </Text>
                <View style={styles.toggleGroup}>
                    <TouchableOpacity
                        style={[styles.toggleBtn, mode === 'month' && styles.toggleBtnActive]}
                        onPress={() => setMode('month')}
                    >
                        <Text style={[styles.toggleText, mode === 'month' && styles.toggleTextActive]}>Month</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleBtn, mode === 'year' && styles.toggleBtnActive]}
                        onPress={() => setMode('year')}
                    >
                        <Text style={[styles.toggleText, mode === 'year' && styles.toggleTextActive]}>Year</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <SpendingStackChart
                stackData={stackData}
                incomeData={incomeData}
                heightScale={1}
            />

            <View style={styles.navRow}>
                <TouchableOpacity
                    style={[styles.navBtn, !canGoBack && styles.navBtnHidden]}
                    onPress={() => canGoBack && handleScroll(-1)}
                    disabled={!canGoBack}
                >
                    <Text style={styles.navText}>◀</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.navBtn, !canGoForward && styles.navBtnHidden]}
                    onPress={() => canGoForward && handleScroll(1)}
                    disabled={!canGoForward}
                >
                    <Text style={styles.navText}>▶</Text>
                </TouchableOpacity>
            </View>

            {/* Segment popup modal */}
            <Modal
                visible={!!activeSegment}
                transparent
                animationType="fade"
                onRequestClose={() => setActiveSegment(null)}
            >
                <Pressable style={styles.popupBackdrop} onPress={() => setActiveSegment(null)}>
                    <Pressable style={styles.popupBox} onPress={() => {}}>
                        <Text style={styles.popupText}>{segmentLabel}</Text>
                        <TouchableOpacity onPress={() => setActiveSegment(null)} style={styles.popupClose}>
                            <Text style={styles.popupCloseText}>Dismiss</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginVertical: 8,
        paddingHorizontal: 4,
    },
    sectionLabel: {
        fontSize: 14,
        color: '#555',
        flex: 1,
    },
    toggleGroup: {
        flexDirection: 'row',
        gap: 6,
    },
    toggleBtn: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#2E5C8A',
    },
    toggleBtnActive: {
        backgroundColor: '#2E5C8A',
    },
    toggleText: {
        color: '#2E5C8A',
        fontWeight: '600',
        fontSize: 13,
    },
    toggleTextActive: {
        color: '#fff',
    },
    navRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        marginTop: 4,
    },
    navBtn: {
        padding: 8,
    },
    navBtnHidden: {
        opacity: 0,
    },
    navText: {
        fontSize: 18,
        color: '#2E5C8A',
    },
    popupBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    popupBox: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 20,
        width: '100%',
        alignItems: 'center',
        gap: 12,
    },
    popupText: {
        fontSize: 15,
        color: '#222',
        textAlign: 'center',
    },
    popupClose: {
        marginTop: 4,
    },
    popupCloseText: {
        color: '#2E5C8A',
        fontWeight: '600',
    },
});
