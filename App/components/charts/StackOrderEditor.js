import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Switch, ScrollView, StyleSheet } from 'react-native';

// Lets the user reorder the category stacking order for both the year
// and month charts using up/down buttons. "Remember this order" persists
// via AsyncStorage (survives app restarts). "Reset to default" clears
// both the in-session order and any saved one.
//
// Shown as a collapsible panel — tap the header to expand/collapse.
// Up/down buttons move a category one position at a time. The label at
// the top = bottom segment of the bar; label at the bottom = top segment.
// That matches how stacked bars work visually (first item has the most
// stable baseline, last item sits at the tip).
export default function StackOrderEditor({
    effectiveOrder,
    isCustomOrder,
    updateOrder,
    resetOrder,
    persist,
    togglePersist,
}) {
    const [open, setOpen] = useState(false);

    const moveUp = useCallback((index) => {
        if (index === 0) return;
        const next = [...effectiveOrder];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        updateOrder(next);
    }, [effectiveOrder, updateOrder]);

    const moveDown = useCallback((index) => {
        if (index === effectiveOrder.length - 1) return;
        const next = [...effectiveOrder];
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
        updateOrder(next);
    }, [effectiveOrder, updateOrder]);

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={styles.toggle}
                onPress={() => setOpen(o => !o)}
                activeOpacity={0.7}
            >
                <Text style={styles.toggleText}>
                    Stack order {isCustomOrder ? '(custom)' : '(default)'} {open ? '▲' : '▼'}
                </Text>
            </TouchableOpacity>

            {open && (
                <View>
                    <Text style={styles.hint}>
                        Top of list = bottom of bar. Use ↑ ↓ to reorder.
                    </Text>

                    {effectiveOrder.map((cat, index) => (
                        <View key={cat} style={styles.row}>
                            <Text style={styles.label} numberOfLines={1}>{cat}</Text>
                            <View style={styles.buttons}>
                                <TouchableOpacity
                                    style={[styles.btn, index === 0 && styles.btnDisabled]}
                                    onPress={() => moveUp(index)}
                                    disabled={index === 0}
                                >
                                    <Text style={[styles.btnText, index === 0 && styles.btnTextDisabled]}>↑</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.btn, index === effectiveOrder.length - 1 && styles.btnDisabled]}
                                    onPress={() => moveDown(index)}
                                    disabled={index === effectiveOrder.length - 1}
                                >
                                    <Text style={[styles.btnText, index === effectiveOrder.length - 1 && styles.btnTextDisabled]}>↓</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}

                    <View style={styles.controls}>
                        <View style={styles.persistRow}>
                            <Text style={styles.persistLabel}>Remember this order</Text>
                            <Switch
                                value={persist}
                                onValueChange={togglePersist}
                                trackColor={{ false: '#ccc', true: '#2E5C8A' }}
                                thumbColor="#fff"
                            />
                        </View>

                        {isCustomOrder && (
                            <TouchableOpacity
                                style={styles.resetButton}
                                onPress={resetOrder}
                            >
                                <Text style={styles.resetText}>Reset to default</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 8,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        overflow: 'hidden',
    },
    toggle: {
        padding: 12,
        backgroundColor: '#f5f5f5',
    },
    toggleText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333',
    },
    hint: {
        fontSize: 11,
        color: '#888',
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#eee',
        backgroundColor: '#fff',
    },
    label: {
        flex: 1,
        fontSize: 13,
        color: '#333',
    },
    buttons: {
        flexDirection: 'row',
        gap: 4,
    },
    btn: {
        width: 32,
        height: 32,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#2E5C8A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnDisabled: {
        borderColor: '#ddd',
    },
    btnText: {
        fontSize: 16,
        color: '#2E5C8A',
        lineHeight: 20,
    },
    btnTextDisabled: {
        color: '#ccc',
    },
    controls: {
        padding: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#eee',
        backgroundColor: '#fafafa',
    },
    persistRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    persistLabel: {
        fontSize: 13,
        color: '#333',
    },
    resetButton: {
        paddingVertical: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#d94f4f',
        borderRadius: 6,
    },
    resetText: {
        fontSize: 13,
        color: '#d94f4f',
        fontWeight: '600',
    },
});
