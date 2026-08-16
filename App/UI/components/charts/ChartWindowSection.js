import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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

    if (!ready || !hasData) return null;

    const activeEntries = mode === 'year' ? yearWindowEntries : monthWindow;
    const stackData = buildStackDataFromEntries(activeEntries, mode === 'year' ? jumpMonthWindowToYear : null);
    const incomeData = incomeForEntries(activeEntries);

    const canGoBack = mode === 'year' ? canScrollYearBack : canScrollMonthBack;
    const canGoForward = mode === 'year' ? canScrollYearForward : canScrollMonthForward;

    function handleScroll(direction) {
        if (mode === 'year') scrollYearWindow(direction);
        else scrollMonthWindow(direction);
    }

    return (
        <View>
            <View style={styles.headerRow}>
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
        </View>
    );
}

const styles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginVertical: 8,
    },
    toggleBtn: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2E5C8A',
    },
    toggleBtnActive: {
        backgroundColor: '#2E5C8A',
    },
    toggleText: {
        color: '#2E5C8A',
        fontWeight: '600',
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
});
