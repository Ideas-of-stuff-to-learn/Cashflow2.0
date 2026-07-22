import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContentsData } from '../customHooks/contentsscreen/useContentsData';
import TransactionRow from '../components/contents/TransactionRow';
import TableHeader from '../components/contents/TableHeader';
import CategoryChipRow from '../components/contents/CategoryChipRow';
import SelectionBar from '../components/contents/SelectionBar';
import StatusBanners from '../components/contents/StatusBanners';
import CategoryResolveModal from '../components/contents/CategoryResolveModal';
import '../styles/contentsStyles.css';

export default function ContentsScreen() {
    const navigate = useNavigate();

    const {
        transactions,
        categorising,
        initialLoading,
        initialLoadError,
        onRetryInitialLoad,

        searchText, setSearchText,
        selectedCategories, toggleCategory, clearCategories,
        sortField, sortAsc, toggleSort,
        availableCategories, filtered,

        selectionMode, setSelectionMode,
        selectedIds,
        exitSelectionMode,
        selectAllFiltered, deselectAll,
        deleting, handleDeleteSelected,

        reviewItem,
        bulkPickerVisible, openBulkPicker,
        outOfSyncMessage,
        manualReviewCount,
        handleCategoryPick,
        closeModal,

        selectableCategories,

        onToggle, onOpenPicker, onEnterSelectionMode,
    } = useContentsData();

    return (
        <div className="container">
            <h1 className="title">Your CSV contents will go here</h1>
            <button className="button" onClick={() => navigate(-1)}>
                Back to Home
            </button>

            <input
                className="search"
                placeholder="Search descriptions..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
            />

            <CategoryChipRow
                availableCategories={availableCategories}
                selectedCategories={selectedCategories}
                onToggleCategory={toggleCategory}
                onClearCategories={clearCategories}
            />

            <StatusBanners
                outOfSyncMessage={outOfSyncMessage}
                initialLoading={initialLoading}
                initialLoadError={initialLoadError}
                onRetry={onRetryInitialLoad}
                categorising={categorising}
            />

            {selectionMode && (
                <SelectionBar
                    selectedCount={selectedIds.size}
                    onCancel={exitSelectionMode}
                    onSelectAll={selectAllFiltered}
                    onDeselectAll={deselectAll}
                    onChangeCategory={() => selectedIds.size > 0 && openBulkPicker()}
                    onDelete={handleDeleteSelected}
                    deleting={deleting}
                />
            )}

            <div className="row-count-row">
                <span className="row-count">
                    {filtered.length} of {transactions.length} transactions
                </span>
                {!selectionMode && (
                    <button className="select-entry-text" onClick={() => setSelectionMode(true)}>
                        Select
                    </button>
                )}
            </div>

            <TableHeader
                selectionMode={selectionMode}
                sortField={sortField}
                sortAsc={sortAsc}
                onToggleSort={toggleSort}
            />

            <div className="table">
                {filtered.map((item, index) => (
                    <TransactionRow
                        key={item.id || `${item.date}-${item.description}-${item.amount}`}
                        item={item}
                        index={index}
                        isSelected={selectedIds.has(item.id)}
                        inSelectionMode={selectionMode}
                        onToggle={onToggle}
                        onOpenPicker={onOpenPicker}
                        onEnterSelectionMode={onEnterSelectionMode}
                    />
                ))}
            </div>

            <CategoryResolveModal
                reviewItem={reviewItem}
                bulkPickerVisible={bulkPickerVisible}
                selectedCount={selectedIds.size}
                manualReviewCount={manualReviewCount}
                selectableCategories={selectableCategories}
                onPickCategory={handleCategoryPick}
                onClose={closeModal}
            />
        </div>
    );
}