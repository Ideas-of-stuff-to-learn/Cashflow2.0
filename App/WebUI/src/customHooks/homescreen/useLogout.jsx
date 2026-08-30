import { useNavigate } from 'react-router-dom';
import { logout } from '../../api';
import { useAuth } from '../../appState';

export function useLogout() {
    const navigate = useNavigate();
    const { endSession } = useAuth();

    const handleLogout = async () => {
        const confirmed = window.confirm('Are you sure you want to log out?');
        console.log('confirmed:', confirmed);
        if (!confirmed) return;

        endSession();
        console.log('endSession done');
        await logout();
        console.log('logout() resolved');
        navigate('/login', { replace: true });
        console.log('navigate called');
    };
    return {
        handleLogout,
    };
}