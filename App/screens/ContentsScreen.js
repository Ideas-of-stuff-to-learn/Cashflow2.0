import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {Text, View, TouchableOpacity, ScrollView, TextInput, FlatList, Modal, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../AppContext.js';
import { resolveCategories, getCategories, getTransactionHistory, deleteTransactions } from '../api.js';
import { NEEDS_MANUAL_REVIEW, NOT_YET_CATEGORISED } from '../checkingName.js';
import { styles } from '../styles/contentsStyles.js';
// A transaction's category is stale if it holds a real, non-empty value
// that isn't the pending state and isn't the manual-review sentinel, but
// also doesn't appear anywhere in the current valid category list -
// meaning it was assigned correctly at some point, but the ground truth
// has since changed underneath it (e.g. renamed via the admin tool)
// without this transaction's stored record being told about it.
function isStale(transaction, categoryNames) {
    if (!transaction.category) return false;                          // pending, not stale
    if (transaction.category === NEEDS_MANUAL_REVIEW) return false;    // sentinel, expected absent from categoryNames
    if (transaction.category === NOT_YET_CATEGORISED) return false;    // sentinel, expected absent from categoryNames
    return !categoryNames.includes(transaction.category);
}



export default function ContentsScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { transactions, setTransactions, categorising, categoryNames, initialLoading, setCategories, bumpChartDataVersion } = useApp();

    const [searchText, setSearchText] = useState('');
    const [selectedCategories, setSelectedCategories] = useState(new Set());
    const [sortField, setSortField] = useState('date');
    const [sortAsc, setSortAsc] = useState(false);

    // Single-row resolve/override
    const [reviewItem, setReviewItem] = useState(null);
    const [resolving, setResolving] = useState(false);
    // Transient message shown when the backend skips a resolution
    // because our local category list was stale (e.g. renamed since
    // we last fetched). Cleared automatically after a couple seconds.
    const [outOfSyncMessage, setOutOfSyncMessage] = useState(null);

    // In-flight guard so overlapping effect runs don't fire duplicate
    // resync requests - not strictly required (the scan naturally stops
    // finding staleness once a resync actually succeeds), but avoids
    // hammering the API if something's genuinely stuck.
    const resyncInFlight = useRef(false);

    // Proactive staleness check - runs whenever the loaded transactions
    // or the valid category list change. Catches a rename that happened
    // out-of-band (e.g. via the admin script) the moment a stale
    // category is actually displayed, rather than waiting for a failed
    // resolve attempt to discover it later.
    useEffect(() => {
        if (initialLoading) return;          // categories haven't loaded even once yet
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

    // Multi-select (long-press) state
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkPickerVisible, setBulkPickerVisible] = useState(false);

    const selectableCategories = categoryNames;

    const availableCategories = useMemo(() => {
        const cats = new Set(transactions.map(t => t.category).filter(Boolean));
        return [...cats].sort();
    }, [transactions]);


    const filtered = useMemo(() => {
        let rows = [...transactions];

        // Text search across description
        if (searchText.trim()) {
            const q = searchText.toLowerCase();
            rows = rows.filter(t =>
                t.description?.toLowerCase().includes(q)
            );
        }

        // Category filter
        if (selectedCategories.size > 0) {
            rows = rows.filter(t => selectedCategories.has(t.category));
        }

        // Sort
        rows.sort((a, b) => {
            let aVal, bVal;
            if (sortField === 'date') {
                // DD/MM/YYYY → sort correctly
                const parseDate = d => {
                    if (!d) return 0;
                    const [dd, mm, yyyy] = d.split('/');
                    return new Date(yyyy, mm - 1, dd).getTime();
                };
                aVal = parseDate(a.date);
                bVal = parseDate(b.date);
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
    }, [transactions, searchText, selectedCategories, sortField, sortAsc]);

    function toggleCategory(cat) {
        const next = new Set(selectedCategories);
        next.has(cat) ? next.delete(cat) : next.add(cat);
        setSelectedCategories(next);
    }
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

    // --- Selection helpers ---
    function toggleSelected(id) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }
    function exitSelectionMode() {
        setSelectionMode(false);
        setSelectedIds(new Set());
    }
    // Selects every currently-visible row (i.e. respecting whatever
    // search/category filters are active) that actually has a category
    // to reassign - pending rows (no category yet) are excluded, same
    // restriction as tapping/long-pressing an individual row.
    function selectAllFiltered() {
        const ids = filtered.filter(t => t.category).map(t => t.id);
        setSelectedIds(new Set(ids));
    }
    // Clears the selection but stays in selection mode, distinct from
    // Cancel/exitSelectionMode which leaves selection mode entirely.
    function deselectAll() {
        setSelectedIds(new Set());
    }

    const [deleting, setDeleting] = useState(false);

    // Deletes every currently-selected transaction. Optimistic like the
    // category-pick flow above: removes them from local state
    // immediately, then confirms with the backend - if the backend
    // call fails, puts them back rather than leaving the UI showing
    // something that isn't actually true.
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
                            // Deleting changes what charts should
                            // total up to - same signal used after a
                            // categorisation chunk lands.
                            bumpChartDataVersion();
                        } catch (e) {
                            console.warn('Delete failed:', e.message);
                            // Put them back - the backend never
                            // actually removed them, so neither should we.
                            setTransactions(prev => [...prev, ...removed]);
                        } finally {
                            setDeleting(false);
                        }
                    },
                },
            ],
        );
    }

    // --- Shared category-pick handler for both single and bulk resolve.
    // bulkPickerVisible decides which path runs: bulk applies the chosen
    // category to every currently-selected transaction in one request;
    // single applies it to just reviewItem, same as before.
    //
    // Applies optimistically, then checks the backend's actual response:
    // if anything came back in `skipped` (most likely because our local
    // category list was stale - e.g. a category got renamed since we
    // last fetched), those specific rows get reverted back to their
    // original category, a brief "out of sync" message shows, and the
    // category list gets refreshed - but only reactively, when a skip
    // is actually detected, not on every single resolve.
    function makeKey(t) {
        return `${t.description}|${t.date}|${t.amount}`;
    }

    async function handleCategoryPick(category) {
        setResolving(true);
        try {
            if (bulkPickerVisible) {
                const items = transactions.filter(t => selectedIds.has(t.id));
                if (items.length === 0) {
                    setBulkPickerVisible(false);
                    exitSelectionMode();
                    return;
                }
                const resolutions = items.map(t => ({
                    description: t.description,
                    date: t.date,
                    amount: t.amount,
                    category,
                }));

                // Optimistic update first, same as before
                setTransactions(prev => prev.map(t =>
                    selectedIds.has(t.id) ? { ...t, category } : t
                ));

                const { skipped } = await resolveCategories(resolutions);

                // At least some of these genuinely changed category in
                // the DB (skipped ones didn't, but the rest did) -
                // charts should reflect that, same signal used after a
                // categorisation chunk or a delete.
                bumpChartDataVersion();

                if (skipped && skipped.length > 0) {
                    const skippedKeys = new Set(skipped.map(makeKey));
                    const outOfSyncItems = items.filter(t => skippedKeys.has(makeKey(t)));

                    if (outOfSyncItems.length > 0) {
                        setOutOfSyncMessage(
                            `${outOfSyncItems.length} out of sync - reverting...`
                        );

                        // Revert only the skipped ones back to whatever
                        // category they actually had before this attempt
                        setTransactions(prev => prev.map(t => {
                            const original = outOfSyncItems.find(o => o.id === t.id);
                            return original ? { ...t, category: original.category } : t;
                        }));

                        try {
                            const [freshCategories, freshTransactions] = await Promise.all([
                                getCategories(),
                                getTransactionHistory(),
                            ]);
                            setCategories(freshCategories);
                            setTransactions(freshTransactions);
                        } catch (e) {
                            console.warn('Failed to resync after out-of-sync resolve:', e.message);
                        }

                        setTimeout(() => setOutOfSyncMessage(null), 2500);
                    }
                }

                setBulkPickerVisible(false);
                exitSelectionMode();
            } else if (reviewItem) {
                const originalCategory = reviewItem.category;

                setTransactions(prev => prev.map(t =>
                    (t.id && t.id === reviewItem.id) ||
                    (!t.id && t.date === reviewItem.date && t.description === reviewItem.description && t.amount === reviewItem.amount)
                        ? { ...t, category }
                        : t
                ));

                const { skipped } = await resolveCategories([{
                    description: reviewItem.description,
                    date: reviewItem.date,
                    amount: reviewItem.amount,
                    category,
                }]);

                // Same reasoning as the bulk branch above.
                bumpChartDataVersion();

                if (skipped && skipped.length > 0) {
                    setOutOfSyncMessage('Out of sync - reverting...');

                    setTransactions(prev => prev.map(t =>
                        (t.id && t.id === reviewItem.id) ||
                        (!t.id && t.date === reviewItem.date && t.description === reviewItem.description && t.amount === reviewItem.amount)
                            ? { ...t, category: originalCategory }
                            : t
                    ));

                    try {
                        const [freshCategories, freshTransactions] = await Promise.all([
                            getCategories(),
                            getTransactionHistory(),
                        ]);
                        setCategories(freshCategories);
                        setTransactions(freshTransactions);
                    } catch (e) {
                        console.warn('Failed to resync after out-of-sync resolve:', e.message);
                    }

                    setTimeout(() => setOutOfSyncMessage(null), 2500);
                }

                setReviewItem(null);
            }
        } catch (e) {
            console.warn('Resolve failed:', e.message);
        } finally {
            setResolving(false);
        }
    }

    const renderRow = useCallback(({ item, index }) => {
        const isManual = item.category === NEEDS_MANUAL_REVIEW;
        // Reuses the existing "pending" treatment (not tappable, shown
        // as waiting) for NOT_YET_CATEGORISED too - it's not a real
        // category any more than an empty one is, it's just a
        // transaction that hasn't been acted on yet (this time because
        // a categorisation request ran out of time, see
        // useFileProcessor.js). No separate UI state needed for it.
        const isPending = !item.category || item.category === NOT_YET_CATEGORISED;
        const isSelected = selectedIds.has(item.id);

        function handlePress() {
            if (selectionMode) {
                if (isPending) return;
                toggleSelected(item.id);
            } else {
                if (isPending) return;
                setReviewItem(item);
            }
        }

        function handleLongPress() {
            if (isPending) return;
            setSelectionMode(true);
            toggleSelected(item.id);
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
                {selectionMode && (
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
    }, [selectionMode, selectedIds]);

    return (
    <View style={[styles.container, { paddingBottom: insets.bottom}]}>
        <Text style={styles.title}>Your CSV contents will go here</Text>
        <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.goBack()}
        >
        <Text style={styles.buttonText}>Back to Home</Text>
        </TouchableOpacity>
            {/* Search bar */}
            <TextInput
                style={styles.search}
                placeholder="Search descriptions..."
                placeholderTextColor="#999"
                value={searchText}
                onChangeText={setSearchText}
            />

            {/* Category filter chips */}
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

            {/* Out-of-sync banner - shown briefly when a resolve gets
                skipped by the backend (stale local category list) */}
            {outOfSyncMessage && (
                <View style={styles.outOfSyncBanner}>
                    <Text style={styles.outOfSyncBannerText}>
                        ⚠️ {outOfSyncMessage}
                    </Text>
                </View>
            )}

            {/* Initial data loading banner - shown while transaction
                history and categories are still being fetched */}
            {initialLoading && (
                <View style={styles.banner}>
                    <Text style={styles.bannerText}>
                        ⏳ Loading your data...
                    </Text>
                </View>
            )}

            {/* Categorising banner */}
            {categorising && (
                <View style={styles.banner}>
                    <Text style={styles.bannerText}>
                        ⏳ Categorising in background...
                    </Text>
                </View>
            )}

            {/* Selection toolbar - shown once selection mode is active,
                whether entered via long-press or the "Select" button below */}
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

            {/* Row count, plus an entry point into selection mode that
                doesn't require long-pressing a specific row first - lets
                you filter, then go straight to "Select All" */}
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

            {/* Table header */}
            <View style={styles.tableHeader}>
                {selectionMode && <View style={styles.checkboxHeaderSpacer} />}
                <SortHeader label="Date" field="date" />
                <View style={[styles.headerCell, styles.cellDesc]}>
                    <Text style={styles.headerText}>Description</Text>
                </View>
                <SortHeader label="Amount" field="amount" />
                <SortHeader label="Category" field="category" />
            </View>

            {/* Table rows */}
            <FlatList
                data={filtered}
                keyExtractor={item => item.id || `${item.date}-${item.description}-${item.amount}`}
                renderItem={renderRow}
                style={styles.table}
            />

            {/* Category picker modal - shared by single resolve and bulk resolve */}
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
                                    disabled={resolving}
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