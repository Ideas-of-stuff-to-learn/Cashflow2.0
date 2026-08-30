import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { getMe } from '../api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userRole, setUserRole] = useState(null);
    const lastLoggedInUsernameRef = useRef(null);

    useEffect(() => {
        if (!isLoggedIn) return;
        let cancelled = false;
        getMe()
            .then(data => { if (!cancelled) setUserRole(data); })
            .catch(e => console.warn('Failed to load role info:', e.message));
        return () => { cancelled = true; };
    }, [isLoggedIn]);

    const completeLogin = useCallback((username) => {
        if (username !== lastLoggedInUsernameRef.current) {
            setUserRole(null);
        }
        lastLoggedInUsernameRef.current = username;
        setIsLoggedIn(true);
    }, []);

    const endSession = useCallback(() => {
        setIsLoggedIn(false);
    }, []);

    return (
        <AuthContext.Provider value={{ isLoggedIn, userRole, completeLogin, endSession }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
