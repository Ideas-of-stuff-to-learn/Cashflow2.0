// components/RequireAuth.jsx
import { Navigate } from 'react-router-dom';
import { useApp } from '../AppContext';

export default function RequireAuth({ children }) {
    const { isLoggedIn } = useApp(); // adjust to whatever your context actually exposes

    if (!isLoggedIn) {
        return <Navigate to="/login" replace />;
    }
    return children;
}