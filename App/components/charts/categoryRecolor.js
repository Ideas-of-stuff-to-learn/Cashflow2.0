import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { styles } from '../../styles/chartStyes.js';
//import { COLOR_PALETTE } from '../../utils/charts/chartUtils.js';
import ColorPicker, { Panel1, HueCircular, Preview } from 'reanimated-color-picker';

const localStyles = StyleSheet.create({
    colorPickerContainer: {
        alignItems: 'center',
        marginBottom: 16,
        padding: 8,
        backgroundColor: '#F0F4F8',
        borderRadius: 8,
    },
});

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
    // Seed the wheel with whichever colour the first selected category
    // already has, so opening the picker doesn't always reset to some
    // arbitrary default - falls back to a sensible default only if
    // nothing's selected yet (shouldn't normally happen, since the
    // toggle below is disabled until something is selected).
    const firstSelected = [...recolorSelected][0];
    const initialColor = (firstSelected && categoryColors[firstSelected]) || '#2E5C8A';
    
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
                <View style={localStyles.colorPickerContainer}>
                    <ColorPicker
                        style={{ width: 260 }}
                        value={initialColor}
                        // applyColor is an async function (network call +
                        // setState) - NOT worklet-safe, so this must be
                        // onCompleteJS (plain JS callback), not onComplete
                        // (which requires a Reanimated worklet and would
                        // silently fail to actually call our function).
                        // Fires once, when you lift your finger off the
                        // wheel/slider - not continuously while dragging.
                        onCompleteJS={(color) => applyColor(color.hex)}
                    >
                        <Preview />
                        <Panel1 style={{ height: 200 }} />
                        <HueCircular style={{ marginTop: 12 }} />
                    </ColorPicker>
                    {applyingColor && (
                        <Text style={styles.chipText}>Saving…</Text>
                    )}
                </View>
            )}
        </>
    );
}

/*
                   {COLOR_PALETTE.map(hex => (
                        <TouchableOpacity
                            key={hex}
                            style={[styles.swatch, { backgroundColor: hex }]}
                            onPress={() => applyColor(hex)}
                            disabled={applyingColor}
                        />
                    ))}

*/