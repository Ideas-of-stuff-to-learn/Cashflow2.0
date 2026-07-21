import { useCallback } from 'react';
import { Text, View, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useContentsData } from '../customHooks/contentsscreen/useContentsData.js';
import TransactionRow from '../components/contents/TransactionRow.js';
import TableHeader from '../components/contents/TableHeader.js';
import CategoryChipRow from '../components/contents/CategoryChipRow.js';
import SelectionBar from '../components/contents/SelectionBar.js';
import StatusBanners from '../components/contents/StatusBanners.js';
import CategoryResolveModal from '../components/contents/CategoryResolveModal.js';
import { styles, ROW_HEIGHT } from '../styles/contentsStyles.js';

export default function ContentsScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();

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

    // renderRow reads selectedIds and selectionMode from state directly -
    // no stale refs. renderRow recreates when either changes, but that's
    // fine: renderRow itself is cheap. What matters is that TransactionRow
    // (React.memo) gets accurate isSelected/inSelectionMode booleans so it
    // can correctly skip re-rendering rows whose values didn't change.
    // Tapping a checkbox: selectedIds changes -> renderRow recreates ->
    // FlatList calls it for visible rows -> memo compares per-row booleans
    // -> only the one row whose isSelected flipped actually re-renders.
    const renderRow = useCallback(({ item, index }) => {
        return (
            <TransactionRow
                item={item}
                index={index}
                isSelected={selectedIds.has(item.id)}
                inSelectionMode={selectionMode}
                onToggle={onToggle}
                onOpenPicker={onOpenPicker}
                onEnterSelectionMode={onEnterSelectionMode}
            />
        );
    }, [selectedIds, selectionMode, onToggle, onOpenPicker, onEnterSelectionMode]);

    return (
    <View style={[styles.container, { paddingBottom: insets.bottom}]}>
        <Text style={styles.title}>Your CSV contents will go here</Text>
        <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.goBack()}
        >
        <Text style={styles.buttonText}>Back to Home</Text>
        </TouchableOpacity>
            <TextInput
                style={styles.search}
                placeholder="Search descriptions..."
                placeholderTextColor="#999"
                value={searchText}
                onChangeText={setSearchText}
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

            <View style={styles.rowCountRow}>
                <Text style={styles.rowCount}>
                    {filtered.length} of {transactions.length} transactions
                </Text>
                {!selectionMode && (
                    <TouchableOpacity onPress={() => setSelectionMode(true)}>
                        <Text style={styles.selectEntryText}>Select</Text>
                    </TouchableOpacity>
                )}
            </View>

            <TableHeader
                selectionMode={selectionMode}
                sortField={sortField}
                sortAsc={sortAsc}
                onToggleSort={toggleSort}
            />

            <FlatList
                data={filtered}
                keyExtractor={item => item.id || `${item.date}-${item.description}-${item.amount}`}
                renderItem={renderRow}
                style={styles.table}
                windowSize={5}
                maxToRenderPerBatch={20}
                updateCellsBatchingPeriod={50}
                removeClippedSubviews={true}
                initialNumToRender={20}
                getItemLayout={(data, index) => ({
                    length: ROW_HEIGHT,
                    offset: ROW_HEIGHT * index,
                    index,
                })}
            />

            <CategoryResolveModal
                reviewItem={reviewItem}
                bulkPickerVisible={bulkPickerVisible}
                selectedCount={selectedIds.size}
                manualReviewCount={manualReviewCount}
                selectableCategories={selectableCategories}
                onPickCategory={handleCategoryPick}
                onClose={closeModal}
            />
    </View>
    );
}
