import { useCallback } from 'react';
import { useApp } from '../../AppContext';
import { useTransactionFilters } from './useCategoryFilters';
import { useSelectionMode } from './useSelectionMode';
import { useCategoryResolve } from './useCategoryResolve';
import { useStalenessResync } from './useStalenessResync';

export function useContentsData() {
    const {
        transactions, setTransactions, categorising, categoryNames,
        initialLoading, setCategories, bumpChartDataVersion,
        initialLoadError, setInitialLoadError, retryInitialLoad,
    } = useApp();

    useStalenessResync({ transactions, categoryNames, initialLoading, setCategories, setTransactions });

    const {
        searchText, setSearchText,
        selectedCategories, toggleCategory, toggleAllCategories,
        sortField, sortAsc, toggleSort,
        availableCategories, filtered,
    } = useTransactionFilters(transactions);

    const {
        selectionMode, setSelectionMode,
        selectedIds,
        toggleSelected, exitSelectionMode, enterSelectionMode,
        selectAllFiltered, deselectAll,
        deleting, handleDeleteSelected,
    } = useSelectionMode({ transactions, filtered, setTransactions, bumpChartDataVersion });

    const {
        reviewItem, openReviewItem,
        bulkPickerVisible, setBulkPickerVisible,
        outOfSyncMessage,
        manualReviewCount,
        handleCategoryPick,
        closeModal,
    } = useCategoryResolve({ transactions, setTransactions, setCategories, bumpChartDataVersion, selectedIds, exitSelectionMode });

    const onToggle = useCallback((id) => toggleSelected(id), [toggleSelected]);
    const onOpenPicker = useCallback((item) => openReviewItem(item), [openReviewItem]);
    const onEnterSelectionMode = useCallback((id) => enterSelectionMode(id), [enterSelectionMode]);

    const handleRetryInitialLoad = useCallback(() => {
        setInitialLoadError(null);
        retryInitialLoad();
    }, [setInitialLoadError, retryInitialLoad]);

    const openBulkPicker = useCallback(() => setBulkPickerVisible(true), [setBulkPickerVisible]);

    return {
        transactions,
        categorising,
        initialLoading,
        initialLoadError,
        onRetryInitialLoad: handleRetryInitialLoad,

        searchText, setSearchText,
        selectedCategories, toggleCategory, toggleAllCategories,
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

        selectableCategories: categoryNames,

        onToggle, onOpenPicker, onEnterSelectionMode,
    };
}