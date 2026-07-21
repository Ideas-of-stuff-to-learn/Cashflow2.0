import { memo } from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { NEEDS_MANUAL_REVIEW, NOT_YET_CATEGORISED } from '../../checkingName';
import { styles } from '../../styles/contentsStyles';

// Extracted as its own file (not just outside ContentsScreen) so
// React.memo works properly - memo does a shallow prop comparison per
// row, and if none of a specific row's props changed, React skips
// re-rendering that row entirely.
//
// Props are either primitives (isSelected, inSelectionMode, index) or
// stable references (item is the same object reference while the
// transaction list is unchanged; onToggle/onOpenPicker are stable
// useCallbacks from useContentsData). That's the contract that makes
// memo's shallow comparison actually skip rows - an inline arrow
// function as a prop would be a new reference every render and defeat
// this entirely.
//
// Press handlers are defined inside the component (not in the parent)
// precisely so they can close over `item` - a stable reference - without
// the parent needing to create a per-item callback that would itself be
// a new reference on every render.
const TransactionRow = memo(function TransactionRow({
    item,
    index,
    isSelected,
    inSelectionMode,
    onToggle,
    onOpenPicker,
    onEnterSelectionMode,
}) {
    const isManual = item.category === NEEDS_MANUAL_REVIEW;
    const isFailed = item.category === NOT_YET_CATEGORISED;
    const isWaiting = !item.category;
    const isPending = isWaiting || isFailed;

    function handlePress() {
        if (isPending) return;
        if (inSelectionMode) {
            onToggle(item.id);
        } else {
            onOpenPicker(item);
        }
    }

    function handleLongPress() {
        if (isPending) return;
        onEnterSelectionMode(item.id);
    }

    return (
        <TouchableOpacity
            style={[
                styles.row,
                index % 2 === 0 && styles.rowAlt,
                isManual && styles.rowManual,
                isFailed && styles.rowFailed,
                isSelected && styles.rowSelected,
            ]}
            onPress={handlePress}
            onLongPress={handleLongPress}
            disabled={isPending}
        >
            {inSelectionMode && (
                <View style={styles.checkboxCell}>
                    <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                        {isSelected && <Text style={styles.checkboxMark}>✓</Text>}
                    </View>
                </View>
            )}
            <Text style={[styles.cell, styles.cellDate]}>{item.date}</Text>
            <Text style={[styles.cell, styles.cellDesc]} numberOfLines={2}>
                {item.description}
            </Text>
            <Text style={[styles.cell, styles.cellAmount]}>
                £{Math.abs(item.amount || 0).toFixed(2)}
            </Text>
            <Text style={[styles.cell, styles.cellCat,
                isManual && styles.cellManual,
                isWaiting && styles.cellPending,
                isFailed && styles.cellFailed,
            ]}>
                {isWaiting ? '...' : isFailed ? '↻ Try again' : item.category}
            </Text>
        </TouchableOpacity>
    );
});

export default TransactionRow;
