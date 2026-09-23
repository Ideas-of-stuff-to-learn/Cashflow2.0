import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { deleteTransactions } from '../../api.js';

export function useSelectionMode({ transactions, filtered, setTransactions, bumpChartDataVersion }) {
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [deleting, setDeleting] = useState(false);

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

    const enterSelectionMode = useCallback((id) => {
        setSelectionMode(true);
        toggleSelected(id);
    }, [toggleSelected]);

    // Reads `filtered` at call time (not memoised) - same as the
    // original inline function, since it only needs whatever's
    // currently on screen at the moment the button is pressed.
    const selectAllFiltered = useCallback(() => {
        const ids = filtered.filter(t => t.category).map(t => t.id);
        setSelectedIds(new Set(ids));
    }, [filtered]);

    const deselectAll = useCallback(() => {
        setSelectedIds(new Set());
    }, []);

    const handleDeleteSelected = useCallback(() => {
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
    }, [selectedIds, transactions, setTransactions, bumpChartDataVersion, exitSelectionMode]);

    return {
        selectionMode, setSelectionMode,
        selectedIds,
        toggleSelected, exitSelectionMode, enterSelectionMode,
        selectAllFiltered, deselectAll,
        deleting, handleDeleteSelected,
    };
}
