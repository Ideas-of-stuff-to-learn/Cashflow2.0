import { useRef, useMemo, useCallback } from 'react';
import { useVirtualizer, useWindowVirtualizer } from '@tanstack/react-virtual';
import { useContentsData } from '../customHooks/contentsscreen/useContentsData';
import { ROW_HEIGHT } from '../utils/contentsscreen/contentsUtils';
import { useIsMobile } from '../customHooks/useIsMobile';
import { useUserPreferences } from '../appState/UserPreferencesContext';
import TransactionRow from '../components/contents/TransactionRow';
import TableHeader from '../components/contents/TableHeader';
import SelectionBar from '../components/contents/SelectionBar';
import StatusBanners from '../components/contents/StatusBanners';
import CategoryResolveModal from '../components/contents/CategoryResolveModal';
import '../styles/contentsStyles.css';

const COL_VARS = ['date', 'desc', 'amount', 'cat'];

export default function ContentsScreen() {
    const tableRef = useRef(null);
    const isMobile = useIsMobile();
    const {
        columnWidthsDesktop, setColumnWidthsDesktop,
        columnWidthsMobile,  setColumnWidthsMobile,
    } = useUserPreferences();

    const columnWidths    = isMobile ? columnWidthsMobile  : columnWidthsDesktop;
    const setColumnWidths = isMobile ? setColumnWidthsMobile : setColumnWidthsDesktop;

    const hasCustomWidths = columnWidths && Object.keys(columnWidths).length > 0;

    const resetColumnWidths = useCallback(() => {
        setColumnWidths({});
        COL_VARS.forEach(col => document.documentElement.style.removeProperty(`--col-${col}`));
    }, [setColumnWidths]);

    const {
        transactions,
        categorising,
        initialLoading,
        initialLoadError,
        onRetryInitialLoad,

        searchText, setSearchText,
        selectedCategories, toggleCategory, toggleAllCategories,
        sortField, sortAsc, toggleSort,
        availableCategories, filtered,
        categoryColors,

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

    // On mobile: window scroll so the whole page scrolls as one unit.
    // On desktop: internal table scroll (virtualiser needs a fixed container).
    const desktopVirtualizer = useVirtualizer({
        count: isMobile ? 0 : filtered.length,
        getScrollElement: () => tableRef.current,
        estimateSize: () => ROW_HEIGHT,
        measureElement: el => el?.getBoundingClientRect().height,
        overscan: 5,
    });
    const mobileVirtualizer = useWindowVirtualizer({
        count: isMobile ? filtered.length : 0,
        estimateSize: () => ROW_HEIGHT,
        measureElement: el => el?.getBoundingClientRect().height,
        overscan: 5,
        scrollMargin: tableRef.current?.offsetTop ?? 0,
    });
    const virtualizer = isMobile ? mobileVirtualizer : desktopVirtualizer;

    const allCatsSelected = availableCategories.length > 0 &&
        availableCategories.every(cat => selectedCategories.has(cat));

    const categoryCounts = useMemo(() => {
        const counts = {};
        for (const t of transactions) {
            if (t.category) counts[t.category] = (counts[t.category] || 0) + 1;
        }
        return counts;
    }, [transactions]);

    return (
        <div className="cs-container">
            {/* Body: sidebar + main */}
            <div className="cs-body">

                {/* Category sidebar */}
                <div className="cs-sidebar">
                    <div className="cs-sidebar-offset" />
                    <div className="cs-sidebar-head">Filter by category</div>

                    <button
                        className={`cs-cat-item${allCatsSelected ? ' cs-cat-item-active' : ''}`}
                        onClick={() => toggleAllCategories(availableCategories)}
                    >
                        <span className="cs-cat-dot" style={{ background: '#aaa' }} />
                        <span className="cs-cat-name">All</span>
                        <span className="cs-cat-count">{transactions.length.toLocaleString()}</span>
                    </button>

                    {availableCategories.map(cat => (
                        <button
                            key={cat}
                            className={`cs-cat-item${selectedCategories.has(cat) && !allCatsSelected ? ' cs-cat-item-active' : ''}`}
                            onClick={() => toggleCategory(cat)}
                        >
                            <span className="cs-cat-dot" style={{ background: categoryColors?.[cat] || '#bbb' }} />
                            <span className="cs-cat-name">{cat}</span>
                            <span className="cs-cat-count">{(categoryCounts[cat] || 0).toLocaleString()}</span>
                        </button>
                    ))}

                    {hasCustomWidths && (
                        <button className="cs-reset-cols-btn" onClick={resetColumnWidths}>
                            Reset column widths
                        </button>
                    )}
                </div>

                {/* Main content */}
                <div className="cs-main">
                    <StatusBanners
                        outOfSyncMessage={outOfSyncMessage}
                        initialLoading={initialLoading}
                        initialLoadError={initialLoadError}
                        onRetry={onRetryInitialLoad}
                        categorising={categorising}
                    />

                    <div className="cs-search-wrap">
                        <input
                            className="cs-search"
                            placeholder="Search descriptions..."
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                        />
                    </div>

                    {selectionMode ? (
                        <SelectionBar
                            selectedCount={selectedIds.size}
                            onCancel={exitSelectionMode}
                            onSelectAll={selectAllFiltered}
                            onDeselectAll={deselectAll}
                            onChangeCategory={() => selectedIds.size > 0 && openBulkPicker()}
                        />
                    ) : (
                        <div className="cs-count-row">
                            <span className="cs-count-text">
                                {filtered.length.toLocaleString()} of {transactions.length.toLocaleString()} transactions
                            </span>
                            <button className="cs-select-link" onClick={() => setSelectionMode(true)}>
                                Select
                            </button>
                        </div>
                    )}

                    <TableHeader
                        selectionMode={selectionMode}
                        sortField={sortField}
                        sortAsc={sortAsc}
                        onToggleSort={toggleSort}
                        columnWidths={columnWidths}
                        setColumnWidths={setColumnWidths}
                        isMobile={isMobile}
                    />

                    <div className="cs-table" ref={tableRef}>
                        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                            {virtualizer.getVirtualItems().map(virtualRow => {
                                const item = filtered[virtualRow.index];
                                const offsetTop = virtualRow.start - (isMobile ? (virtualizer.options.scrollMargin ?? 0) : 0);
                                return (
                                    <TransactionRow
                                        key={item.id || `${item.date}-${item.description}-${item.amount}`}
                                        ref={virtualizer.measureElement}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            transform: `translateY(${offsetTop}px)`,
                                        }}
                                        item={item}
                                        index={virtualRow.index}
                                        isSelected={selectedIds.has(item.id)}
                                        inSelectionMode={selectionMode}
                                        onToggle={onToggle}
                                        onOpenPicker={onOpenPicker}
                                        onEnterSelectionMode={onEnterSelectionMode}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>
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
