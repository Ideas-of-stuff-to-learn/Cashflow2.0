import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, TouchableOpacity, Text } from 'react-native';
import { useApp } from '../AppContext';
import SpendingOverview from '../components/charts/SpendingOverview.js';
import YearlyChartSection from '../components/charts/Yearlychartsection.js';
import CategorySlicer from '../components/charts/categorySlicer.js';
import DetailedChartSection from '../components/charts/DetailedChartSection.js';
import StatusBanners from '../components/charts/StatusBanners.js';
import StackOrderEditor from '../components/charts/StackOrderEditor.js';
import { useChartData } from '../customHooks/charts/useChartData.js';
import { useDetailedChartReveal } from '../customHooks/charts/useDetailedChartReveal.js';
import { styles } from '../styles/chartStyes.js';

export default function ChartsScreen({ navigation }) {
    const {
        categorising,
        initialLoading,
        processingStage,
    } = useApp();
    const insets = useSafeAreaInsets();

    const {
        showingDummyData,
        hasData,
        effectiveOrder,
        updateOrder,
        resetOrder,
        persist,
        togglePersist,
        isCustomOrder,
        yearChartData,
        yearIncomeLineData,
        allTimeChartData2,
        selectedBar,
        selectedYear,
        selectedYearSegment,
        selectedYearTotal,
        monthChartData,
        monthIncomeLineData,
        selectedSegment,
        availableCategories,
        selectedCategories,
        setSelectedCategories,
        toggleItem,
        selectAll,
        closeDrilldown,
    } = useChartData();


    const showYearChart = useDetailedChartReveal();

    return (
      <ScrollView style={styles.container}
    contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}>

        <Text style={styles.title}>Spending by Category</Text>
        <StatusBanners initialLoading={initialLoading} processingStage={processingStage} showingDummyData={showingDummyData} />

        <SpendingOverview
            hasData={hasData}
            filteredChartData2={allTimeChartData2}
            categorising={categorising}
            initialLoading={initialLoading}
            selectedBar={selectedBar}
        />

        <CategorySlicer
            availableCategories={availableCategories}
            selectedCategories={selectedCategories}
            setSelectedCategories={setSelectedCategories}
            toggleItem={toggleItem}
            selectAll={selectAll}
        />

        <StackOrderEditor
            effectiveOrder={effectiveOrder}
            isCustomOrder={isCustomOrder}
            updateOrder={updateOrder}
            resetOrder={resetOrder}
            persist={persist}
            togglePersist={togglePersist}
        />

        <YearlyChartSection
            ready={showYearChart}
            hasData={hasData}
            showingDummyData={showingDummyData}
            yearChartData={yearChartData}
            yearIncomeLineData={yearIncomeLineData}
            selectedYear={selectedYear}
            selectedYearSegment={selectedYearSegment}
            selectedYearTotal={selectedYearTotal}
        />

        <DetailedChartSection
            selectedYear={selectedYear}
            monthChartData={monthChartData}
            monthIncomeLineData={monthIncomeLineData}
            selectedSegment={selectedSegment}
            closeDrilldown={closeDrilldown}
        />
        {/* 
           Category colour customisation - inline, not a modal 
           
            <CategoryRecolor
                availableCategories={availableCategories}
                recolorSelected={recolorSelected}
                categoryColors={categoryColors}
                toggleRecolorCategory={toggleRecolorCategory}
                recolorSelectAll={recolorSelectAll}
                recolorDeselectAll={recolorDeselectAll}
                colorPickerOpen={colorPickerOpen}
                setColorPickerOpen={setColorPickerOpen}
                applyingColor={applyingColor}
                applyColor={applyColor}
                resetToDefaults={resetToDefaults}
            />
        */}
          <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.goBack()}
          >
          <Text style={styles.buttonText}>Back to Home</Text>
          </TouchableOpacity>
      </ScrollView>
    );
}