import { View, Text, StyleSheet } from 'react-native';
import { useApp } from '../AppContext.js';

// Small pill shown top-right of every authenticated screen (wired in
// via App.js's Stack.Navigator screenOptions.headerRight, ONE place,
// rather than added to each screen individually) for anyone whose role
// is above the plain 'user' tier. A plain user sees nothing here at
// all - this is purely a "who am I" indicator for elevated accounts,
// not a control of any kind; every actual permission-gated action
// still lives in the admin CLI tools, same as before this system
// existed.
//
// Colour is chosen by role name for the two built-in elevated tiers
// (owner/admin), falling back to a neutral colour for any custom role
// created later - a brand new role doesn't need a colour decision made
// for it up front just to be visible here.
const ROLE_COLORS = {
    owner: '#C4A227', // gold - matches the shared admin-CLI palette
    admin: '#2E5C8A', // the app's main accent blue
};
const DEFAULT_ROLE_COLOR = '#7A5C3D';

function capitalize(word) {
    if (!word) return '';
    return word.charAt(0).toUpperCase() + word.slice(1);
}

export default function RoleBadge() {
    const { userRole } = useApp();

    // Nothing to show yet (still loading) or a plain user (level 0,
    // or userRole never resolved because they're not elevated at all).
    if (!userRole || !userRole.level) return null;

    const color = ROLE_COLORS[userRole.role] || DEFAULT_ROLE_COLOR;

    return (
        <View style={[styles.badge, { backgroundColor: color }]}>
            <Text style={styles.text}>{capitalize(userRole.role)}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 12,
        marginRight: 12,
    },
    text: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
});
