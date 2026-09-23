import { useNavigate } from 'react-router-dom';
import { logout } from '../../api';
import { useAuth } from '../../appState';

export function useLogout() {
    const navigate = useNavigate();
    const { endSession } = useAuth();

    const handleLogout = async () => {
        endSession();
        await logout();
        navigate('/login', { replace: true });
    };
    return {
        handleLogout,
    };
}