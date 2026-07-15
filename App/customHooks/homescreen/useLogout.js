import { Alert } from 'react-native';
import { logout } from '../../api.js';
import { useNavigation } from '@react-navigation/native';

export function useLogout(){
    
    const navigation = useNavigation();

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
                        // 1. Clear any local states, auth headers, or tokens here if you are storing them 
                        // (e.g., AsyncStorage.clear() or resetting a state manager)
                        await logout();
                        // 2. Clear the navigation stack and force-route back to Login
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