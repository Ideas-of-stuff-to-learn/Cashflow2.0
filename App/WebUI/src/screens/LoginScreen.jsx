import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, getMe } from '../api';
import { useApp } from '../AppContext';
import '../styles/LoginScreen.css'

export default function LoginScreen() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [checkingStoredSession, setCheckingStoredSession] = useState(true);
    const [retryCount, setRetryCount] = useState(0);
    const { completeLogin } = useApp();
    const navigate = useNavigate();

    // No local token to check for existence anymore - the cookie is
    // invisible to JS either way, so we just ask the server directly.
    // getMe() going through authorizedFetch still handles the silent
    // refresh-and-retry on a 401 exactly as before; this call still
    // validates the entire chain the same way the original comment
    // describes, just without a "does a token exist locally" early-out.
    useEffect(() => {
        let cancelled = false;
        setError(null);
        setCheckingStoredSession(true);

        async function checkStoredSession() {
            try {
                const me = await getMe();
                if (cancelled) return;
                completeLogin(me.username);
                navigate('/contents', { replace: true });
            } catch (e) {
                if (cancelled) return;
                const msg = e.message || '';
                if (msg.includes('starting up')) {
                    setError(msg);
                } else {
                    console.log('[startup] No usable stored session:', msg);
                }
            } finally {
                if (!cancelled) setCheckingStoredSession(false);
            }
        }

        checkStoredSession();
        return () => { cancelled = true; };
    }, [retryCount]);

    async function handleLogin(e) {
        e.preventDefault();
        if (!username.trim() || !password.trim()) {
            setError('Please enter username and password');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const trimmedUsername = username.trim();
            await login(trimmedUsername, password);
            completeLogin(trimmedUsername);
            navigate('/home', { replace: true });
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    if (checkingStoredSession) {
        return (
            <div className="login-container">
                <h1 className="login-title">Transaction Categorizer</h1>
                {error ? (
                    <>
                        <p className="login-error" style={{ textAlign: 'center', marginTop: 24 }}>{error}</p>
                        <button className="login-button" style={{ marginTop: 16 }} onClick={() => setRetryCount(c => c + 1)}>
                            Retry
                        </button>
                    </>
                ) : (
                    <div className="login-spinner" style={{ marginTop: 24 }} />
                )}
            </div>
        );
    }

    return (
        <div className="login-container">
            <h1 className="login-title">Transaction Categorizer</h1>
            <p className="login-subtitle">Sign in to continue</p>

            <form onSubmit={handleLogin}>
                <input
                    className="login-input"
                    placeholder="Username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoCapitalize="none"
                    autoCorrect="off"
                />

                <input
                    className="login-input"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    type="password"
                />

                {error && <p className="login-error">{error}</p>}

                <button className="login-button" type="submit" disabled={loading}>
                    {loading ? '...' : 'Sign in'}
                </button>
            </form>

            <button className="login-switch" onClick={() => navigate('/signup')}>
                Don't have an account? Sign up
            </button>
        </div>
    );
}
