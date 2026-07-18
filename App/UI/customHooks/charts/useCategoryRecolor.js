import { useState } from 'react';
import { useApp } from '../../AppContext.js';
import { updateCategory, resetCategoryDefaults } from '../../api.js';
import {toggleItem} from '../../utils/charts/chartUtils.js'

export function useCategoryRecolor(availableCategories) {
    const { setCategories } = useApp();

    const [recolorSelected, setRecolorSelected] = useState(new Set());
    const [colorPickerOpen, setColorPickerOpen] = useState(false);
    const [applyingColor, setApplyingColor] = useState(false);

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

    return {
        recolorSelected,
        colorPickerOpen, setColorPickerOpen,
        applyingColor,
        toggleRecolorCategory,
        recolorSelectAll,
        recolorDeselectAll,
        applyColor,
        resetToDefaults,
    };
}