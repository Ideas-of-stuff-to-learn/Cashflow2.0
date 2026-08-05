import { useState, useMemo, useCallback } from 'react';
import { useIsMobile } from '../useIsMobile';
import { useApp } from '../../AppContext';

export function useTransactionFilters(transactions) {
    const [searchText, setSearchText] = useState('');
    const [sortField, setSortField] = useState('date');
    const [sortAsc, setSortAsc] = useState(false);

    const isMobile = useIsMobile();
    const {
        contentsSelectedCategories, toggleContentsCategory, toggleAllContentsCategories,
        mobileSelectedCategories, toggleMobileCategory, toggleAllMobileCategories,
    } = useApp();

    // Which of the two independent filter states this screen actually
    // uses is decided PURELY by current viewport width - matches the
    // width-based split used throughout the rest of the app
    // (ResponsiveGate, etc.), not by which button was clicked to
    // navigate here.
    const selectedCategories = isMobile ? mobileSelectedCategories : contentsSelectedCategories;
    const toggleCategory = isMobile ? toggleMobileCategory : toggleContentsCategory;
    const toggleAllCategories = isMobile ? toggleAllMobileCategories : toggleAllContentsCategories;

    const availableCategories = useMemo(() => {
        const cats = new Set(transactions.map(t => t.category).filter(Boolean));
        return [...cats].sort();
    }, [transactions]);

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

        const rows = [];
        const rowDates = [];
        for (let i = 0; i < transactions.length; i++) {
            const t = transactions[i];
            if (q && !t.description?.toLowerCase().includes(q)) continue;
            // No more hasCatFilter gate - selectedCategories now
            // honestly represents exactly what's visible at all times
            // (checkbox-list semantics), so this check always applies,
            // with no "empty means show everything" special case.
            if (!selectedCategories.has(t.category)) continue;
            rows.push(t);
            rowDates.push(parsedDates[i]);
        }

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
        selectedCategories, toggleCategory, toggleAllCategories,
        sortField, sortAsc, toggleSort,
        availableCategories, filtered,
    };
}