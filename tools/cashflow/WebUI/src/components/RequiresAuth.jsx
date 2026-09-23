// components/RequireAuth.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../appState';

export default function RequireAuth({ children }) {
    const { isLoggedIn } = useAuth();

    if (!isLoggedIn) {
        return <Navigate to="/login" replace />;
    }
    return children;
}