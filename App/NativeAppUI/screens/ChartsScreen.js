import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, TouchableOpacity, Text } from 'react-native';
import { useApp } from '../AppContext';
import StatusBanners from '../components/charts/StatusBanners.js';
import ChartWindowSection from '../components/charts/ChartWindowSection.js';
import ChartFootnote from '../components/charts/ChartFootnote.js';
import FilterPane from '../components/dashboard/FilterPane.js';
import { useChartData } from '../customHooks/charts/useChartData.js';
import { useDetailedChartReveal } from '../customHooks/charts/useDetailedChartReveal.js';
import { styles } from '../styles/chartStyes.js';

export default function ChartsScreen({ navigation }) {
    const { categorising, initialLoading, processingStage, categoryColors } = useApp();
    const insets = useSafeAreaInsets();

    const {
        hasData,
        effectiveOrder, isCustomOrder, updateOrder, resetOrder, persist, togglePersist,
        availableCategories, selectedCategories, toggleCategory, toggleAllCategories,
        monthWindow, yearWindowEntries,
        scrollMonthWindow, scrollYearWindow, jumpMonthWindowToYear,
        canScrollMonthBack, canScrollMonthForward,
        canScrollYearBack, canScrollYearForward,
        buildStackDataFromEntries,
        incomeForEntries,
    } = useChartData();

    const showYearChart = useDetailedChartReveal();

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        >
            <StatusBanners initialLoading={initialLoading} processingStage={processingStage} showingDummyData={false} />

            <FilterPane
                availableCategories={availableCategories}
                selectedCategories={selectedCategories}
                toggleCategory={toggleCategory}
                toggleAllCategories={toggleAllCategories}
                categoryColors={categoryColors}
                effectiveOrder={effectiveOrder}
                isCustomOrder={isCustomOrder}
                updateOrder={updateOrder}
                resetOrder={resetOrder}
                persist={persist}
                togglePersist={togglePersist}
            />

            <ChartWindowSection
                ready={showYearChart}
                hasData={hasData}
                monthWindow={monthWindow}
                yearWindowEntries={yearWindowEntries}
                scrollMonthWindow={scrollMonthWindow}
                scrollYearWindow={scrollYearWindow}
                jumpMonthWindowToYear={jumpMonthWindowToYear}
                canScrollMonthBack={canScrollMonthBack}
                canScrollMonthForward={canScrollMonthForward}
                canScrollYearBack={canScrollYearBack}
                canScrollYearForward={canScrollYearForward}
                buildStackDataFromEntries={buildStackDataFromEntries}
                incomeForEntries={incomeForEntries}
            />

            <ChartFootnote />

            <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
                <Text style={styles.buttonText}>Back to Home</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}
