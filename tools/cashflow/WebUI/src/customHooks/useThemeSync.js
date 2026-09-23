import { useEffect } from 'react';
import { useTransactions } from '../appState';
import { updateCategory } from '../api';
import { getActiveThemeChartColors } from '../styles/themes/chartColors';

const STORAGE_KEY = 'appliedChartTheme';

// Detects when active.css has been changed to a different theme and
// auto-pushes the new theme's chart colour palette to the server.
// Runs once after categories are first populated; subsequently runs
// whenever the category list changes (e.g. after a reset-defaults).
// Uses localStorage to track which theme's colours are already applied
// so repeated reloads with the same theme are silent no-ops.
export function useThemeSync() {
    const { categories, setCategories } = useTransactions();

    useEffect(() => {
        if (!categories || categories.length === 0) return;

        const themeName = getComputedStyle(document.documentElement)
            .getPropertyValue('--theme-name')
            .trim();

        if (!themeName) return;

        const alreadyApplied = localStorage.getItem(STORAGE_KEY);
        if (alreadyApplied === themeName) return;

        const palette = getActiveThemeChartColors();
        const updates = categories
            .map((cat, i) => palette[i] ? { name: cat.name, color: palette[i] } : null)
            .filter(Boolean);

        Promise.all(updates.map(({ name, color }) => updateCategory(name, { color })))
            .then(() => {
                const colorMap = Object.fromEntries(updates.map(({ name, color }) => [name, color]));
                setCategories(prev => prev.map(c =>
                    colorMap[c.name] ? { ...c, color: colorMap[c.name] } : c
                ));
                localStorage.setItem(STORAGE_KEY, themeName);
            })
            .catch(err => console.warn('Theme chart colour sync failed:', err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categories.length]);
}
