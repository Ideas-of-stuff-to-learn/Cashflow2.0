import { useState } from 'react';
import { useTransactions } from '../../appState';
import { updateCategory, resetCategoryDefaults } from '../../api';
import { toggleItem } from '../../utils/charts/chartUtils';
import { getActiveThemeChartColors } from '../../styles/themes/chartColors';

export function useCategoryRecolor(availableCategories) {
    const { setCategories } = useTransactions();

    const [recolorSelected, setRecolorSelected] = useState(new Set());
    const [colorPickerOpen, setColorPickerOpen] = useState(false);
    const [applyingColor, setApplyingColor] = useState(false);
    const [applyingThemeColors, setApplyingThemeColors] = useState(false);

    function toggleRecolorCategory(cat) {
        toggleItem(recolorSelected, setRecolorSelected, cat);
    }

    function recolorSelectAll() {
        setRecolorSelected(new Set(availableCategories));
    }

    function recolorDeselectAll() {
        setRecolorSelected(new Set());
    }

    async function applyColor(hex) {
        if (recolorSelected.size === 0) return;
        setApplyingColor(true);
        try {
            const names = [...recolorSelected];
            // One PATCH per selected category - the existing endpoint
            // already supports colour-only updates, no new backend work
            // needed for this at all.
            await Promise.all(names.map(name => updateCategory(name, { color: hex })));
            setCategories(prev => prev.map(c =>
                recolorSelected.has(c.name) ? { ...c, color: hex } : c
            ));
            setRecolorSelected(new Set());
            setColorPickerOpen(false);
        } catch (e) {
            console.warn('Colour update failed:', e.message);
        } finally {
            setApplyingColor(false);
        }
    }

    // Resets the selected categories back to their own default_color -
    // same scoping as applyColor (only the currently-selected
    // categories), just going to each one's own original colour instead
    // of one shared new colour. Backend returns the full refreshed list
    // directly, so this just replaces categories wholesale rather than
    // patching client-side like applyColor does.
    async function resetToDefaults() {
        if (recolorSelected.size === 0) return;
        setApplyingColor(true);
        try {
            const names = [...recolorSelected];
            const data = await resetCategoryDefaults(names);
            setCategories(data.categories);
            setRecolorSelected(new Set());
            setColorPickerOpen(false);
        } catch (e) {
            console.warn('Reset to defaults failed:', e.message);
        } finally {
            setApplyingColor(false);
        }
    }

    // Applies the active theme's built-in colour palette to all categories
    // in their current display order — categories[0] gets palette[0], etc.
    // Only touches categories that exist in availableCategories, so
    // extra palette slots are silently ignored and surplus categories
    // fall back to their existing colour.
    async function applyThemeColors() {
        setApplyingThemeColors(true);
        try {
            const palette = getActiveThemeChartColors();
            const updates = availableCategories
                .map((name, i) => palette[i] ? { name, color: palette[i] } : null)
                .filter(Boolean);
            await Promise.all(updates.map(({ name, color }) => updateCategory(name, { color })));
            const colorMap = Object.fromEntries(updates.map(({ name, color }) => [name, color]));
            setCategories(prev => prev.map(c =>
                colorMap[c.name] ? { ...c, color: colorMap[c.name] } : c
            ));
        } catch (e) {
            console.warn('Apply theme colours failed:', e.message);
        } finally {
            setApplyingThemeColors(false);
        }
    }

    return {
        recolorSelected,
        colorPickerOpen, setColorPickerOpen,
        applyingColor,
        applyingThemeColors,
        toggleRecolorCategory,
        recolorSelectAll,
        recolorDeselectAll,
        applyColor,
        resetToDefaults,
        applyThemeColors,
    };
}