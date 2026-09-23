import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getMe } from '../api';

const AuthContext = createContext();

const HINT_KEY = 'auth_hint';
function readHint() { try { return sessionStorage.getItem(HINT_KEY) === '1'; } catch { return false; } }
function setHint() { try { sessionStorage.setItem(HINT_KEY, '1'); } catch {} }
function clearHint() { try { sessionStorage.removeItem(HINT_KEY); } catch {} }

export function AuthProvider({ children }) {
    const hasHint = readHint();

    const [isLoggedIn, setIsLoggedIn] = useState(hasHint);
    const [isChecking, setIsChecking] = useState(!hasHint);
    const [userRole, setUserRole] = useState(null);

    useEffect(() => {
        let cancelled = false;
        getMe()
            .then(data => {
                if (cancelled) return;
                setUserRole(data);
                setIsLoggedIn(true);
                setHint();
            })
            .catch(() => {
                if (cancelled) return;
                setIsLoggedIn(false);
                clearHint();
            })
            .finally(() => {
                if (!cancelled) setIsChecking(false);
            });
        return () => { cancelled = true; };
    }, []);

    const endSession = useCallback(() => {
        setIsLoggedIn(false);
        setUserRole(null);
        clearHint();
    }, []);

    useEffect(() => {
        function handleExpired() {
            setIsLoggedIn(false);
            setUserRole(null);
            clearHint();
        }
        window.addEventListener('auth:session-expired', handleExpired);
        return () => window.removeEventListener('auth:session-expired', handleExpired);
    }, []);

    return (
        <AuthContext.Provider value={{ isLoggedIn, isChecking, userRole, endSession }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
