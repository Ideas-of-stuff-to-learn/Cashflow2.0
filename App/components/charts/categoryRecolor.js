import { View, TouchableOpacity, Text } from 'react-native';
import { styles } from '../../styles/chartStyes.js';
import { COLOR_PALETTE } from '../../utils/charts/chartUtils.js';

export default function CategoryRecolor({
    availableCategories,
    recolorSelected,
    categoryColors,
    toggleRecolorCategory,
    recolorSelectAll,
    recolorDeselectAll,
    colorPickerOpen,
    setColorPickerOpen,
    applyingColor,
    applyColor,
}) {
    return (
        <>
            <Text style={styles.slicerLabel}>Customise Category Colours</Text>
            <View style={styles.chipRow}>
                <TouchableOpacity style={styles.chip} onPress={recolorSelectAll}>
                    <Text style={styles.chipText}>Select All</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.chip} onPress={recolorDeselectAll}>
                    <Text style={styles.chipText}>Deselect All</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.chipWrap}>
                {availableCategories.map(cat => {
                    const isSelected = recolorSelected.has(cat);
                    const catColor = categoryColors[cat] || '#BBBBBB';
                    return (
                        <TouchableOpacity
                            key={cat}
                            style={[
                                styles.colourChip,
                                { borderColor: catColor },
                                isSelected && { backgroundColor: catColor },
                            ]}
                            onPress={() => toggleRecolorCategory(cat)}
                        >
                            <View style={[styles.colourDot, { backgroundColor: catColor }]} />
                            <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                                {cat}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <TouchableOpacity
                style={[styles.dropdownToggle, recolorSelected.size === 0 && styles.dropdownToggleDisabled]}
                onPress={() => recolorSelected.size > 0 && setColorPickerOpen(o => !o)}
                disabled={recolorSelected.size === 0}
            >
                <Text style={styles.dropdownToggleText}>
                    {colorPickerOpen
                        ? 'Hide colour picker  ▲'
                        : `Choose colour for ${recolorSelected.size} selected  ▼`}
                </Text>
            </TouchableOpacity>

            {colorPickerOpen && (
                <View style={styles.swatchGrid}>
                    {COLOR_PALETTE.map(hex => (
                        <TouchableOpacity
                            key={hex}
                            style={[styles.swatch, { backgroundColor: hex }]}
                            onPress={() => applyColor(hex)}
                            disabled={applyingColor}
                        />
                    ))}
                </View>
            )}
        </>
    );
}