import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signup } from '../api';
import { useApp } from '../AppContext';
import '../styles/LoginScreen.css'; // reuse the same styles - identical layout
import { POST_LOGIN_ROUTE } from '../config/routes';

export default function SignupScreen() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { completeLogin } = useApp();
    const navigate = useNavigate();

    async function handleSignup(e) {
        e.preventDefault();
        if (!username.trim() || !password.trim() || !confirmPassword.trim()) {
            setError('Please fill in all fields');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const trimmedUsername = username.trim();
            await signup(trimmedUsername, password);
            completeLogin(trimmedUsername);
            navigate(POST_LOGIN_ROUTE, { replace: true });
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="login-container">
            <h1 className="login-title">Create Account</h1>
            <p className="login-subtitle">Sign up to get started</p>

            <form onSubmit={handleSignup}>
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

                <input
                    className="login-input"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    type="password"
                />

                {error && <p className="login-error">{error}</p>}

                <button className="login-button" type="submit" disabled={loading}>
                    {loading ? '...' : 'Create Account'}
                </button>
            </form>

            <button className="login-switch" onClick={() => navigate('/login')}>
                Already have an account? Sign in
            </button>
        </div>
    );
}