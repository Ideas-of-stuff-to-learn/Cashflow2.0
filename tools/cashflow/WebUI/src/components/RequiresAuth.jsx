import { useAuth } from '../appState';

export default function RequireAuth({ children }) {
    const { isLoggedIn, isChecking } = useAuth();

    if (isChecking) return null;

    if (!isLoggedIn) {
        const loginUrl = import.meta.env.PROD
            ? '/utility-tools/login?redirect=/utility-tools/cashflow/'
            : 'http://localhost:5174/login';
        window.location.href = loginUrl;
        return null;
    }
    return children;
}
