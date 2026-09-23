import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getMe } from './api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [userRole, setUserRole] = useState(null);

    useEffect(() => {
        let cancelled = false;
        getMe()
            .then(data => {
                if (cancelled) return;
                setUserRole(data);
                setIsLoggedIn(true);
            })
            .catch(() => {
                if (cancelled) return;
                setIsLoggedIn(false);
            })
            .finally(() => {
                if (!cancelled) setIsChecking(false);
            });
        return () => { cancelled = true; };
    }, []);

    const completeLogin = useCallback(() => {
        setIsLoggedIn(true);
        getMe().then(data => setUserRole(data)).catch(() => {});
    }, []);

    const endSession = useCallback(() => {
        setIsLoggedIn(false);
        setUserRole(null);
    }, []);

    useEffect(() => {
        function handleExpired() { setIsLoggedIn(false); setUserRole(null); }
        window.addEventListener('auth:session-expired', handleExpired);
        return () => window.removeEventListener('auth:session-expired', handleExpired);
    }, []);

    return (
        <AuthContext.Provider value={{ isLoggedIn, isChecking, userRole, completeLogin, endSession }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
