import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { useInitialLoadLogic } from '../customHooks/homescreen/useInitialLoadLogic';
import { useLogout } from '../customHooks/homescreen/useLogout';
import { useFilePicker } from '../customHooks/homescreen/useFilePicker';
import { useFileProcessor } from '../customHooks/homescreen/useFileProcessor';
import { useChartData } from '../customHooks/charts/useChartData';
import { useDetailedChartReveal } from '../customHooks/charts/useDetailedChartReveal';
import { useContentsData } from '../customHooks/contentsscreen/useContentsData';
import { NOT_YET_CATEGORISED } from '../checkingName';

import HomepageInfo from '../components/homepage/homepageInfo';
import YearlyChartSection from '../components/charts/YearlyChartSection';
import DetailedChartSection from '../components/charts/DetailedChartSection';
import StackOrderEditor from '../components/charts/StackOrderEditor';
import CategoryChipRow from '../components/contents/CategoryChipRow';
import TableHeader from '../components/contents/TableHeader';
import TransactionRow from '../components/contents/TransactionRow';
import SelectionBar from '../components/contents/SelectionBar';
import CategoryResolveModal from '../components/contents/CategoryResolveModal';

import '../styles/dashboardStyles.css';

export default function DashboardScreen() {
    const navigate = useNavigate();
    const { categorising, transactions, initialLoadError, retryInitialLoad, allTransactionsLoaded } = useApp();
    const { dateRangeInfo, uploadCount, refetchUploadCount } = useInitialLoadLogic();
    const { handleLogout } = useLogout();
    const { pickFiles, selectedFiles, status, setStatus, error, setError } = useFilePicker();
    const { processFiles, loading } = useFileProcessor(setStatus, setError, selectedFiles);
    const notYetCategorisedCount = transactions.filter(t => t.category === NOT_YET_CATEGORISED).length;

    async function handleCategorisePress() {
        await processFiles();
        refetchUploadCount();
    }

    const {
        hasData, effectiveOrder, updateOrder, resetOrder, persist, togglePersist, isCustomOrder,
        yearChartData, yearIncomeLineData, selectedYear, selectedYearSegment, selectedYearTotal,
        monthChartData, monthIncomeLineData, selectedSegment, showingDummyData, closeDrilldown,
    } = useChartData();
    const showYearChart = useDetailedChartReveal();

    const {
        searchText, setSearchText, selectedCategories, toggleCategory, clearCategories,
        sortField, sortAsc, toggleSort, availableCategories, filtered,
        selectionMode, setSelectionMode, selectedIds, exitSelectionMode,
        selectAllFiltered, deselectAll, deleting, handleDeleteSelected,
        reviewItem, bulkPickerVisible, openBulkPicker, outOfSyncMessage,
        manualReviewCount, handleCategoryPick, closeModal, selectableCategories,
        onToggle, onOpenPicker, onEnterSelectionMode,
    } = useContentsData();

    return (
        <div className="dashboard-grid">
            <div className="dashboard-home-box">
                <HomepageInfo dateRangeInfo={dateRangeInfo} uploadCount={uploadCount} />
                {initialLoadError && (
                    <div className="banner">
                        <p className="banner-text">{initialLoadError}</p>
                        <button className="btn" onClick={retryInitialLoad}>Retry</button>
                    </div>
                )}
                <button className="btn" onClick={pickFiles} disabled={loading || categorising}>Choose CSV Files</button>
                {selectedFiles.length > 0 && (
                    <div className="file-info">
                        {selectedFiles.map(f => <p key={f.name} className="file-info-text">{f.name}</p>)}
                    </div>
                )}
                {status && <p className="status">{status}</p>}
                {error && <p className="error">{error}</p>}
                <button
                    className="btn btn-secondary"
                    onClick={handleCategorisePress}
                    disabled={loading || categorising || !allTransactionsLoaded || (selectedFiles.length === 0 && notYetCategorisedCount === 0)}
                >
                    {loading ? '...' : notYetCategorisedCount > 0 ? `Categorise (retry ${notYetCategorisedCount})` : 'Categorise'}
                </button>
                <button className="logout-btn" onClick={handleLogout}>Log Out</button>
            </div>

            <div className="dashboard-charts-box">
                <StackOrderEditor
                    effectiveOrder={effectiveOrder} isCustomOrder={isCustomOrder}
                    updateOrder={updateOrder} resetOrder={resetOrder}
                    persist={persist} togglePersist={togglePersist}
                />
                <YearlyChartSection
                    ready={showYearChart} hasData={hasData} showingDummyData={showingDummyData}
                    yearChartData={yearChartData} yearIncomeLineData={yearIncomeLineData}
                    selectedYear={selectedYear} selectedYearSegment={selectedYearSegment}
                    selectedYearTotal={selectedYearTotal}
                />
                <DetailedChartSection
                    selectedYear={selectedYear} monthChartData={monthChartData}
                    monthIncomeLineData={monthIncomeLineData} selectedSegment={selectedSegment}
                    closeDrilldown={closeDrilldown}
                />
            </div>

            <div className="dashboard-contents-box">
                <input className="search" placeholder="Search descriptions..." value={searchText} onChange={e => setSearchText(e.target.value)} />
                <TableHeader selectionMode={selectionMode} sortField={sortField} sortAsc={sortAsc} onToggleSort={toggleSort} />
                <CategoryChipRow
                    availableCategories={availableCategories} selectedCategories={selectedCategories}
                    onToggleCategory={toggleCategory} onClearCategories={clearCategories}
                />
                {selectionMode && (
                    <SelectionBar
                        selectedCount={selectedIds.size} onCancel={exitSelectionMode}
                        onSelectAll={selectAllFiltered} onDeselectAll={deselectAll}
                        onChangeCategory={() => selectedIds.size > 0 && openBulkPicker()}
                        onDelete={handleDeleteSelected} deleting={deleting}
                    />
                )}
                <div className="dashboard-table">
                    {filtered.map((item, index) => (
                        <TransactionRow
                            key={item.id || `${item.date}-${item.description}-${item.amount}`}
                            item={item} index={index}
                            isSelected={selectedIds.has(item.id)} inSelectionMode={selectionMode}
                            onToggle={onToggle} onOpenPicker={onOpenPicker} onEnterSelectionMode={onEnterSelectionMode}
                        />
                    ))}
                </div>
            </div>

            <CategoryResolveModal
                reviewItem={reviewItem} bulkPickerVisible={bulkPickerVisible}
                selectedCount={selectedIds.size} manualReviewCount={manualReviewCount}
                selectableCategories={selectableCategories} onPickCategory={handleCategoryPick}
                onClose={closeModal}
            />
        </div>
    );
}