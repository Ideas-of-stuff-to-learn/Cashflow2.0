import { useState, useMemo, useCallback } from 'react';
import { useApp } from '../../AppContext';

export function useTransactionFilters(transactions) {
    const [searchText, setSearchText] = useState('');
    const [sortField, setSortField] = useState('date');
    const [sortAsc, setSortAsc] = useState(false);

    const availableCategories = useMemo(() => {
        const cats = new Set(transactions.map(t => t.category).filter(Boolean));
        return [...cats].sort();
    }, [transactions]);
    const { contentsSelectedCategories: selectedCategories, toggleContentsCategory: toggleCategory, clearContentsCategories: clearCategories } = useApp();
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


    const toggleSort = useCallback((field) => {
        if (sortField === field) {
            setSortAsc(a => !a);
        } else {
            setSortField(field);
            setSortAsc(true);
        }
    }, [sortField]);

    return {
        searchText, setSearchText,
        selectedCategories, toggleCategory, clearCategories,
        sortField, sortAsc, toggleSort,
        availableCategories, filtered,
    };
}
