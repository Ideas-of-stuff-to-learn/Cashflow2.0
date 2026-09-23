import { logout } from '../../api';
import { useAuth } from '../../appState';

export function useLogout() {
    const { endSession } = useAuth();

    const handleLogout = async () => {
        endSession();
        await logout();
        const loginUrl = import.meta.env.PROD
            ? '/utility-tools/login'
            : 'http://localhost:5174/login';
        window.location.href = loginUrl;
    };
    return {
        handleLogout,
    };
}
