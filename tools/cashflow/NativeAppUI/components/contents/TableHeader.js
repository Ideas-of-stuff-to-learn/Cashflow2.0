import { View, Text, TouchableOpacity } from 'react-native';
import { styles } from '../../styles/contentsStyles.js';

function SortHeader({ label, field, sortField, sortAsc, onToggleSort }) {
    const active = sortField === field;
    return (
        <TouchableOpacity onPress={() => onToggleSort(field)} style={styles.headerCell}>
            <Text style={[styles.headerText, active && styles.headerTextActive]}>
                {label} {active ? (sortAsc ? '↑' : '↓') : ''}
            </Text>
        </TouchableOpacity>
    );
}

export default function TableHeader({ selectionMode, sortField, sortAsc, onToggleSort }) {
    return (
        <View style={styles.tableHeader}>
            {selectionMode && <View style={styles.checkboxHeaderSpacer} />}
            <SortHeader label="Date" field="date" sortField={sortField} sortAsc={sortAsc} onToggleSort={onToggleSort} />
            <View style={[styles.headerCell, styles.cellDesc]}>
                <Text style={styles.headerText}>Description</Text>
            </View>
            <SortHeader label="Amount" field="amount" sortField={sortField} sortAsc={sortAsc} onToggleSort={onToggleSort} />
            <SortHeader label="Category" field="category" sortField={sortField} sortAsc={sortAsc} onToggleSort={onToggleSort} />
        </View>
    );
}
