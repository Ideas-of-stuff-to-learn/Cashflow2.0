import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder } from 'react-native';

// RN port of App/WebUI/src/components/dashboard/FilterPane.jsx's combined
// list - category checkbox + colour dot + name + drag handle, all in one
// row, replacing the old separate CategorySlicer (chips) and
// StackOrderEditor (up/down buttons) panels. There's no native HTML5
// drag-and-drop on a phone, so reordering here uses PanResponder on the
// "≡" handle: press and drag it up/down, the row currently under your
// finger gets highlighted, and releasing drops the dragged category into
// that row's position.
const ROW_HEIGHT = 40;

export default function FilterPane({
    availableCategories,
    selectedCategories,
    toggleCategory,
    toggleAllCategories,
    categoryColors,

    effectiveOrder,
    isCustomOrder,
    updateOrder,
    resetOrder,
    persist,
    togglePersist,
}) {
    const [minimized, setMinimized] = useState(false);
    const [dragIndex, setDragIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);

    // Displayed top-to-bottom, so the row a person sees at the top is
    // the top (last-drawn) segment of the stacked bar - the reverse of
    // effectiveOrder, which is bottom-of-bar-first.
    const displayOrder = [...effectiveOrder].reverse();

    // PanResponder state doesn't re-render on its own, so drag progress
    // is tracked in a ref (read inside the responder callbacks) and
    // mirrored into React state (dragOverIndex) only when it actually
    // changes, to drive the highlight.
    const dragStateRef = useRef({ startIndex: null });

    function makeResponder(index) {
        return PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                dragStateRef.current.startIndex = index;
                setDragIndex(index);
                setDragOverIndex(index);
            },
            onPanResponderMove: (_evt, gesture) => {
                const { startIndex } = dragStateRef.current;
                if (startIndex === null) return;
                const offset = Math.round(gesture.dy / ROW_HEIGHT);
                const target = Math.min(displayOrder.length - 1, Math.max(0, startIndex + offset));
                setDragOverIndex(target);
            },
            onPanResponderRelease: () => {
                const { startIndex } = dragStateRef.current;
                const dropIndex = dragOverIndex;
                if (startIndex !== null && dropIndex !== null && startIndex !== dropIndex) {
                    const next = [...displayOrder];
                    const [moved] = next.splice(startIndex, 1);
                    next.splice(dropIndex, 0, moved);
                    updateOrder([...next].reverse());
                }
                dragStateRef.current.startIndex = null;
                setDragIndex(null);
                setDragOverIndex(null);
            },
            onPanResponderTerminate: () => {
                dragStateRef.current.startIndex = null;
                setDragIndex(null);
                setDragOverIndex(null);
            },
        });
    }

    // Standard checkbox-list semantics: "All" is checked when the set
    // genuinely contains every available category, not on emptiness.
    const allSelected = availableCategories.every(cat => selectedCategories.has(cat));

    return (
        <View style={styles.pane}>
            <TouchableOpacity
                style={styles.header}
                onPress={() => setMinimized(m => !m)}
                activeOpacity={0.7}
            >
                <Text style={styles.title}>
                    Filters {isCustomOrder ? '(custom order)' : ''}
                </Text>
                <Text style={styles.arrow}>{minimized ? '▼' : '▲'}</Text>
            </TouchableOpacity>

            {!minimized && (
                <View>
                    <Text style={styles.hint}>Drag ☰ to reorder — top of list = top of bar</Text>

                    <TouchableOpacity style={styles.checkboxRow} onPress={() => toggleAllCategories(availableCategories)}>
                        <View style={[styles.checkbox, allSelected && styles.checkboxChecked]}>
                            {allSelected && <Text style={styles.checkboxTick}>✓</Text>}
                        </View>
                        <Text style={styles.rowLabel}>All</Text>
                    </TouchableOpacity>

                    {displayOrder.map((cat, index) => {
                        const responder = makeResponder(index);
                        const isChecked = selectedCategories.has(cat);
                        const isDragOver = dragOverIndex === index && dragIndex !== null;
                        const isDragging = dragIndex === index;
                        return (
                            <View
                                key={cat}
                                style={[
                                    styles.combinedRow,
                                    isDragOver && styles.combinedRowDragOver,
                                    isDragging && styles.combinedRowDragging,
                                ]}
                            >
                                <TouchableOpacity style={styles.checkboxRow} onPress={() => toggleCategory(cat)}>
                                    <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                                        {isChecked && <Text style={styles.checkboxTick}>✓</Text>}
                                    </View>
                                    <View style={[styles.colourDot, { backgroundColor: categoryColors?.[cat] || '#BBBBBB' }]} />
                                    <Text style={styles.rowLabel} numberOfLines={1}>{cat}</Text>
                                </TouchableOpacity>
                                <View style={styles.dragHandle} {...responder.panHandlers}>
                                    <Text style={styles.dragHandleText}>☰</Text>
                                </View>
                            </View>
                        );
                    })}

                    <View style={styles.persistRow}>
                        <Text style={styles.persistLabel}>Remember this order</Text>
                        <TouchableOpacity
                            style={[styles.checkbox, persist && styles.checkboxChecked]}
                            onPress={() => togglePersist(!persist)}
                        >
                            {persist && <Text style={styles.checkboxTick}>✓</Text>}
                        </TouchableOpacity>
                    </View>

                    {isCustomOrder && (
                        <TouchableOpacity style={styles.resetBtn} onPress={resetOrder}>
                            <Text style={styles.resetBtnText}>Reset to default</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    pane: {
        backgroundColor: '#F8F9FA',
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 8,
        padding: 12,
        marginVertical: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        paddingBottom: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#ddd',
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    arrow: {
        fontSize: 13,
        color: '#2E5C8A',
    },
    hint: {
        fontSize: 11,
        color: '#888',
        marginBottom: 6,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
        paddingVertical: 4,
    },
    checkbox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#2E5C8A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#2E5C8A',
    },
    checkboxTick: {
        color: '#fff',
        fontSize: 12,
        lineHeight: 14,
    },
    colourDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    rowLabel: {
        fontSize: 13,
        color: '#333',
        flexShrink: 1,
    },
    combinedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        height: ROW_HEIGHT,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    combinedRowDragOver: {
        borderTopColor: '#2E5C8A',
    },
    combinedRowDragging: {
        opacity: 0.5,
    },
    dragHandle: {
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    dragHandleText: {
        color: '#999',
        fontSize: 16,
    },
    persistRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    persistLabel: {
        fontSize: 12,
        color: '#333',
    },
    resetBtn: {
        marginTop: 8,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#d94f4f',
        borderRadius: 6,
        alignItems: 'center',
    },
    resetBtnText: {
        color: '#d94f4f',
        fontSize: 12,
        fontWeight: '600',
    },
});
