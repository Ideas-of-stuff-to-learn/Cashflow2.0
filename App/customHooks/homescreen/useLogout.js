import { Alert } from 'react-native';
import { logout } from '../../api.js';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../../AppContext.js';

export function useLogout(){

    const navigation = useNavigation();
    const { clearSessionState } = useApp();

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
                        // Flip isLoggedIn false and wipe chartSummary
                        // FIRST - stops AppContext's chartSummary effect
                        // from firing again on this now-stale session,
                        // and clears the previous account's numbers out
                        // of memory before whoever logs in next sees
                        // anything (see AppContext.js).
                        clearSessionState();
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
