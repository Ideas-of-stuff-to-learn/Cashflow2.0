import { Alert } from 'react-native';
import { logout } from '../../api.js';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../../AppContext.js';

export function useLogout(){

    const navigation = useNavigation();
    const { endSession } = useApp();

    const handleLogout = () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to log out?",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Logout", 
                    style: "destructive",
                    onPress: async () => {
                        // Stops AppContext's chartSummary effect from
                        // firing again on this now-stale session.
                        // Deliberately does NOT wipe transactions/
                        // categories/chartSummary here - that decision
                        // now happens at the START of the next login
                        // instead, based on whether it's the same
                        // person logging back in (see completeLogin in
                        // AppContext.js). Doing it here unconditionally
                        // would blank the screen for a moment on every
                        // logout, even when the same person immediately
                        // logs back in.
                        endSession();
                        await logout();
                        // Clear the navigation stack and force-route back to Login
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Login' }],
                        });
                    }
                }
            ]
        );
    };
    return {
        handleLogout
    }
}
