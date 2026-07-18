import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react';
import {Text, View, TouchableOpacity, ScrollView, TextInput, FlatList, Modal, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../AppContext.js';
import { resolveCategories, getCategories, getTransactionHistory, deleteTransactions } from '../api.js';
import { NEEDS_MANUAL_REVIEW, NOT_YET_CATEGORISED } from '../checkingName.js';
import { styles } from '../styles/contentsStyles.js';

// Extracted outside ContentsScreen so React.memo works properly.
// memo does a shallow prop comparison per row - if none of a specific
// row's props changed, React skips re-rendering that row entirely.
//
// Props are either primitives (isSelected, inSelectionMode, index) or
// stable references (item is the same object reference while the
// transaction list is unchanged; onToggle/onOpenPicker are stable
// useCallbacks from the parent). That's the contract that makes memo's
// shallow comparison actually skip rows - an inline arrow function as
// a prop would be a new reference every render and defeat this entirely.
//
// Press handlers are defined inside the component (not in the parent)
// precisely so they can close over `item` - a stable reference - without
// the parent needing to create a per-item callback that would itself be
// a new reference on every render.
const TransactionRow = memo(function TransactionRow({
    item,
    index,
    isSelected,
    inSelectionMode,
    onToggle,
    onOpenPicker,
    onEnterSelectionMode,
}) {
    const isManual = item.category === NEEDS_MANUAL_REVIEW;
    const isPending = !item.category || item.category === NOT_YET_CATEGORISED;

    function handlePress() {
        if (isPending) return;
        if (inSelectionMode) {
            onToggle(item.id);
        } else {
            onOpenPicker(item);
        }
    }

    function handleLongPress() {
        if (isPending) return;
        onEnterSelectionMode(item.id);
    }

    return (
        <TouchableOpacity
            style={[
                styles.row,
                index % 2 === 0 && styles.rowAlt,
                isManual && styles.rowManual,
                isSelected && styles.rowSelected,
            ]}
            onPress={handlePress}
            onLongPress={handleLongPress}
            disabled={isPending}
        >
            {inSelectionMode && (
                <View style={styles.checkboxCell}>
                    <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                        {isSelected && <Text style={styles.checkboxMark}>✓</Text>}
                    </View>
                </View>
            )}
            <Text style={[styles.cell, styles.cellDate]}>{item.date}</Text>
            <Text style={[styles.cell, styles.cellDesc]} numberOfLines={2}>
                {item.description}
            </Text>
            <Text style={[styles.cell, styles.cellAmount]}>
                £{Math.abs(item.amount || 0).toFixed(2)}
            </Text>
            <Text style={[styles.cell, styles.cellCat,
                isManual && styles.cellManual,
                isPending && styles.cellPending,
            ]}>
                {isPending ? '...' : item.category}
            </Text>
        </TouchableOpacity>
    );
});

function isStale(transaction, categoryNames) {
    if (!transaction.category) return false;
    if (transaction.category === NEEDS_MANUAL_REVIEW) return false;
    if (transaction.category === NOT_YET_CATEGORISED) return false;
    return !categoryNames.includes(transaction.category);
}

export default function ContentsScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { transactions, setTransactions, categorising, categoryNames, initialLoading, setCategories, bumpChartDataVersion, initialLoadError, setInitialLoadError, retryInitialLoad } = useApp();

    const [searchText, setSearchText] = useState('');
    const [selectedCategories, setSelectedCategories] = useState(new Set());
    const [sortField, setSortField] = useState('date');
    const [sortAsc, setSortAsc] = useState(false);

    const [reviewItem, setReviewItem] = useState(null);
    // resolving is now only used as a ref to guard against double-taps
    // on the modal - we no longer keep the modal open while awaiting
    // the network, so there's no reason to re-render the modal's
    // category list as disabled during the call.
    const resolvingRef = useRef(false);
    const [outOfSyncMessage, setOutOfSyncMessage] = useState(null);
    const resyncInFlight = useRef(false);

    useEffect(() => {
        if (initialLoading) return;
        if (categoryNames.length === 0) return;
        if (resyncInFlight.current) return;

        const anyStale = transactions.some(t => isStale(t, categoryNames));
        if (!anyStale) return;

        let cancelled = false;
        resyncInFlight.current = true;

        async function resync() {
            try {
                const [freshCategories, freshTransactions] = await Promise.all([
                    getCategories(),
                    getTransactionHistory(),
                ]);
                if (!cancelled) {
                    setCategories(freshCategories);
                    setTransactions(freshTransactions);
                }
            } catch (e) {
                console.warn('Proactive staleness resync failed:', e.message);
            } finally {
                resyncInFlight.current = false;
            }
        }
        resync();

        return () => { cancelled = true; };
    }, [transactions, categoryNames, initialLoading]);

    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkPickerVisible, setBulkPickerVisible] = useState(false);

    const selectableCategories = categoryNames;

    const availableCategories = useMemo(() => {
        const cats = new Set(transactions.map(t => t.category).filter(Boolean));
        return [...cats].sort();
    }, [transactions]);

    // Parse once and cache - date parsing is the most expensive single
    // step inside the sort, and the sort runs on every filter change.
    // Keeping a parallel array of timestamps avoids re-parsing the same
    // DD/MM/YYYY strings on every comparator invocation.
    const parsedDates = useMemo(() => {
        return transactions.map(t => {
            if (!t.date) return 0;
            const parts = t.date.split('/');
            if (parts.length !== 3) return 0;
            const [dd, mm, yyyy] = parts;
            return new Date(yyyy, mm - 1, dd).getTime();
        });
    }, [transactions]);

    const filtered = useMemo(() => {
        const q = searchText.trim().toLowerCase();
        const hasCatFilter = selectedCategories.size > 0;

        const rows = [];
        const rowDates = [];
        for (let i = 0; i < transactions.length; i++) {
            const t = transactions[i];
            if (q && !t.description?.toLowerCase().includes(q)) continue;
            if (hasCatFilter && !selectedCategories.has(t.category)) continue;
            rows.push(t);
            rowDates.push(parsedDates[i]);
        }

        // Build a Map from row object -> pre-parsed date ONCE before
        // sorting, so the comparator looks up dates in O(1) rather than
        // calling transactions.indexOf(a) (O(n)) inside the comparator -
        // that turned the sort into O(n^2 log n) and was the freeze.
        const dateMap = new Map(rows.map((r, i) => [r, rowDates[i]]));

        rows.sort((a, b) => {
            let aVal, bVal;
            if (sortField === 'date') {
                aVal = dateMap.get(a) ?? 0;
                bVal = dateMap.get(b) ?? 0;
            } else if (sortField === 'amount') {
                aVal = Math.abs(a.amount || 0);
                bVal = Math.abs(b.amount || 0);
            } else {
                aVal = (a[sortField] || '').toLowerCase();
                bVal = (b[sortField] || '').toLowerCase();
            }
            if (aVal < bVal) return sortAsc ? -1 : 1;
            if (aVal > bVal) return sortAsc ? 1 : -1;
            return 0;
        });

        return rows;
    }, [transactions, parsedDates, searchText, selectedCategories, sortField, sortAsc]);

    const toggleCategory = useCallback((cat) => {
        setSelectedCategories(prev => {
            const next = new Set(prev);
            next.has(cat) ? next.delete(cat) : next.add(cat);
            return next;
        });
    }, []);

    function toggleSort(field) {
        if (sortField === field) {
            setSortAsc(a => !a);
        } else {
            setSortField(field);
            setSortAsc(true);
        }
    }
    function SortHeader({ label, field }) {
        const active = sortField === field;
        return (
            <TouchableOpacity onPress={() => toggleSort(field)} style={styles.headerCell}>
                <Text style={[styles.headerText, active && styles.headerTextActive]}>
                    {label} {active ? (sortAsc ? '↑' : '↓') : ''}
                </Text>
            </TouchableOpacity>
        );
    }

    const toggleSelected = useCallback((id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    const exitSelectionMode = useCallback(() => {
        setSelectionMode(false);
        setSelectedIds(new Set());
    }, []);

    function selectAllFiltered() {
        const ids = filtered.filter(t => t.category).map(t => t.id);
        setSelectedIds(new Set(ids));
    }
    function deselectAll() {
        setSelectedIds(new Set());
    }

    const [deleting, setDeleting] = useState(false);

    async function handleDeleteSelected() {
        const ids = [...selectedIds];
        if (ids.length === 0) return;

        Alert.alert(
            `Delete ${ids.length} transaction${ids.length === 1 ? '' : 's'}?`,
            'This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const removed = transactions.filter(t => selectedIds.has(t.id));
                        setDeleting(true);
                        setTransactions(prev => prev.filter(t => !selectedIds.has(t.id)));
                        exitSelectionMode();
                        try {
                            await deleteTransactions(ids);
                            bumpChartDataVersion();
                        } catch (e) {
                            console.warn('Delete failed:', e.message);
                            setTransactions(prev => [...prev, ...removed]);
                        } finally {
                            setDeleting(false);
                        }
                    },
                },
            ],
        );
    }

    function makeKey(t) {
        return `${t.description}|${t.date}|${t.amount}`;
    }

    // Close the modal IMMEDIATELY on pick, then do the network call in
    // the background. The optimistic update to local transaction state
    // already makes the UI look right instantly - the network call is
    // purely to confirm the server agrees (and to trigger a resync if
    // it doesn't). There's no reason to keep the modal open while that
    // round-trip happens, and doing so is exactly why the modal felt
    // slow: it stayed visible, with all category options rendered as
    // `disabled={resolving}`, for the full network latency of the
    // resolve call, even though the user already made their decision.
    const handleCategoryPick = useCallback(async (category) => {
        if (resolvingRef.current) return; // guard double-tap
        resolvingRef.current = true;

        // Snapshot what we need before closing - reviewItem / selectedIds
        // could be cleared by the time the async work finishes.
        const isBulk = bulkPickerVisible;
        const currentReviewItem = reviewItem;
        const currentSelectedIds = new Set(selectedIds);

        // Close immediately - user sees the result, modal gone.
        setReviewItem(null);
        setBulkPickerVisible(false);
        if (isBulk) exitSelectionMode();

        try {
            if (isBulk) {
                const items = transactions.filter(t => currentSelectedIds.has(t.id));
                if (items.length === 0) return;

                const resolutions = items.map(t => ({
                    description: t.description,
                    date: t.date,
                    amount: t.amount,
                    category,
                }));

                // Optimistic update
                setTransactions(prev => prev.map(t =>
                    currentSelectedIds.has(t.id) ? { ...t, category } : t
                ));

                const { skipped } = await resolveCategories(resolutions);
                bumpChartDataVersion();

                if (skipped && skipped.length > 0) {
                    const skippedKeys = new Set(skipped.map(makeKey));
                    const outOfSyncItems = items.filter(t => skippedKeys.has(makeKey(t)));
                    if (outOfSyncItems.length > 0) {
                        setOutOfSyncMessage(`${outOfSyncItems.length} out of sync - reverting...`);
                        setTransactions(prev => prev.map(t => {
                            const original = outOfSyncItems.find(o => o.id === t.id);
                            return original ? { ...t, category: original.category } : t;
                        }));
                        try {
                            const [freshCategories, freshTransactions] = await Promise.all([getCategories(), getTransactionHistory()]);
                            setCategories(freshCategories);
                            setTransactions(freshTransactions);
                        } catch (e) {
                            console.warn('Failed to resync after out-of-sync bulk resolve:', e.message);
                        }
                        setTimeout(() => setOutOfSyncMessage(null), 2500);
                    }
                }
            } else if (currentReviewItem) {
                const originalCategory = currentReviewItem.category;

                // Optimistic update
                setTransactions(prev => prev.map(t =>
                    (t.id && t.id === currentReviewItem.id) ||
                    (!t.id && t.date === currentReviewItem.date && t.description === currentReviewItem.description && t.amount === currentReviewItem.amount)
                        ? { ...t, category }
                        : t
                ));

                const { skipped } = await resolveCategories([{
                    description: currentReviewItem.description,
                    date: currentReviewItem.date,
                    amount: currentReviewItem.amount,
                    category,
                }]);
                bumpChartDataVersion();

                if (skipped && skipped.length > 0) {
                    setOutOfSyncMessage('Out of sync - reverting...');
                    setTransactions(prev => prev.map(t =>
                        (t.id && t.id === currentReviewItem.id) ||
                        (!t.id && t.date === currentReviewItem.date && t.description === currentReviewItem.description && t.amount === currentReviewItem.amount)
                            ? { ...t, category: originalCategory }
                            : t
                    ));
                    try {
                        const [freshCategories, freshTransactions] = await Promise.all([getCategories(), getTransactionHistory()]);
                        setCategories(freshCategories);
                        setTransactions(freshTransactions);
                    } catch (e) {
                        console.warn('Failed to resync after out-of-sync resolve:', e.message);
                    }
                    setTimeout(() => setOutOfSyncMessage(null), 2500);
                }
            }
        } catch (e) {
            console.warn('Resolve failed:', e.message);
        } finally {
            resolvingRef.current = false;
        }
    }, [bulkPickerVisible, reviewItem, selectedIds, transactions, exitSelectionMode]);

    // onToggle/onOpenPicker/onEnterSelectionMode are stable useCallbacks
    // passed as props to every TransactionRow. Stability is what lets
    // React.memo skip re-rendering a row that didn't change - if these
    // were inline arrows they'd be new references every render and memo
    // would re-render every row regardless.
    //
    // The actual per-item press handlers (what happens when THIS specific
    // row is tapped) are defined inside TransactionRow itself, where they
    // can close over `item` safely without creating per-item callbacks
    // here in the parent.
    const onToggle = useCallback((id) => {
        toggleSelected(id);
    }, [toggleSelected]);

    const onOpenPicker = useCallback((item) => {
        setReviewItem(item);
    }, []);

    const onEnterSelectionMode = useCallback((id) => {
        setSelectionMode(true);
        toggleSelected(id);
    }, [toggleSelected]);

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

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                <TouchableOpacity
                    style={[styles.chip, selectedCategories.size === 0 && styles.chipActive]}
                    onPress={() => setSelectedCategories(new Set())}
                >
                    <Text style={[styles.chipText, selectedCategories.size === 0 && styles.chipTextActive]}>
                        All
                    </Text>
                </TouchableOpacity>
                {availableCategories.map(cat => (
                    <TouchableOpacity
                        key={cat}
                        style={[styles.chip, selectedCategories.has(cat) && styles.chipActive]}
                        onPress={() => toggleCategory(cat)}
                    >
                        <Text style={[styles.chipText, selectedCategories.has(cat) && styles.chipTextActive]}>
                            {cat}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {outOfSyncMessage && (
                <View style={styles.outOfSyncBanner}>
                    <Text style={styles.outOfSyncBannerText}>
                        ⚠️ {outOfSyncMessage}
                    </Text>
                </View>
            )}

            {initialLoading && (
                <View style={styles.banner}>
                    {initialLoadError ? (
                        <>
                            <Text style={styles.bannerText}>{initialLoadError}</Text>
                            <TouchableOpacity
                                style={[styles.button, { marginTop: 8 }]}
                                onPress={() => { setInitialLoadError(null); retryInitialLoad(); }}
                            >
                                <Text style={styles.buttonText}>Retry</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <Text style={styles.bannerText}>⏳ Loading your data...</Text>
                    )}
                </View>
            )}

            {categorising && (
                <View style={styles.banner}>
                    <Text style={styles.bannerText}>
                        ⏳ Categorising in background...
                    </Text>
                </View>
            )}

            {selectionMode && (
                <View style={styles.selectionBar}>
                    <View style={styles.selectionTopRow}>
                        <Text style={styles.selectionText}>{selectedIds.size} selected</Text>
                        <TouchableOpacity style={styles.selectionButton} onPress={exitSelectionMode}>
                            <Text style={styles.selectionButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.selectionBottomRow}>
                        <TouchableOpacity style={styles.selectionButtonSmall} onPress={selectAllFiltered}>
                            <Text style={styles.selectionButtonTextSmall}>Select All</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.selectionButtonSmall} onPress={deselectAll}>
                            <Text style={styles.selectionButtonTextSmall}>Deselect All</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.selectionButtonSmall, styles.selectionButtonPrimary, selectedIds.size === 0 && styles.selectionButtonDisabled]}
                            onPress={() => selectedIds.size > 0 && setBulkPickerVisible(true)}
                            disabled={selectedIds.size === 0}
                        >
                            <Text style={styles.selectionButtonTextPrimary}>Change category</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.selectionButtonSmall, styles.selectionButtonDanger, (selectedIds.size === 0 || deleting) && styles.selectionButtonDisabled]}
                            onPress={handleDeleteSelected}
                            disabled={selectedIds.size === 0 || deleting}
                        >
                            <Text style={styles.selectionButtonTextDanger}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                </View>
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

            <View style={styles.tableHeader}>
                {selectionMode && <View style={styles.checkboxHeaderSpacer} />}
                <SortHeader label="Date" field="date" />
                <View style={[styles.headerCell, styles.cellDesc]}>
                    <Text style={styles.headerText}>Description</Text>
                </View>
                <SortHeader label="Amount" field="amount" />
                <SortHeader label="Category" field="category" />
            </View>

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
            />

            <Modal
                visible={!!reviewItem || bulkPickerVisible}
                transparent
                animationType="fade"
                onRequestClose={() => { setReviewItem(null); setBulkPickerVisible(false); }}
            >
                <Pressable
                    style={styles.modalBackdrop}
                    onPress={() => { setReviewItem(null); setBulkPickerVisible(false); }}
                >
                    <Pressable style={styles.modalCard} onPress={() => {}}>
                        <Text style={styles.modalTitle}>
                            {bulkPickerVisible
                                ? `Categorise ${selectedIds.size} transaction${selectedIds.size === 1 ? '' : 's'}`
                                : 'Categorise this transaction'}
                        </Text>
                        {!bulkPickerVisible && reviewItem && (
                            <>
                                <Text style={styles.modalDesc}>{reviewItem.description}</Text>
                                <Text style={styles.modalAmount}>
                                    £{Math.abs(reviewItem.amount || 0).toFixed(2)} · {reviewItem.date}
                                </Text>
                            </>
                        )}
                        <ScrollView style={styles.modalList}>
                            {selectableCategories.map(cat => (
                                <TouchableOpacity
                                    key={cat}
                                    style={styles.modalOption}
                                    onPress={() => handleCategoryPick(cat)}
                                >
                                    <Text style={styles.modalOptionText}>{cat}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
    </View>
    );
}
