import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { resetPassword } from '../api';
import '../styles/LoginScreen.css';
import { APP_TITLE } from '../appTitle';

export default function ResetPasswordScreen() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState(null);

    const token = searchParams.get('token');

    async function handleSubmit(e) {
        e.preventDefault();
        if (!password || !confirm) {
            setError('Please fill in both fields.');
            return;
        }
        if (password !== confirm) {
            setError('Passwords do not match.');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (!token) {
            setError('Missing reset token. Please use the link from your email.');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            await resetPassword(token, password);
            setDone(true);
        } catch (e) {
            const code = e.code;
            if (code === 'token_used') {
                setError('This reset link has already been used. Request a new one from the sign-in page.');
            } else if (code === 'invalid_token') {
                setError('This link is invalid or has expired (links expire after 5 minutes). Request a new one.');
            } else {
                setError(e.message || 'Password reset failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    }

    if (!token) {
        return (
            <div className="login-container">
                <h1 className="login-title">{APP_TITLE}</h1>
                <p className="login-subtitle">Invalid link</p>
                <p className="login-error" style={{ textAlign: 'center', marginTop: 16 }}>
                    No reset token found. Please use the link from your email.
                </p>
                <button className="login-button" style={{ marginTop: 16 }} onClick={() => navigate('/login')}>
                    Back to sign in
                </button>
            </div>
        );
    }

    if (done) {
        return (
            <div className="login-container">
                <h1 className="login-title">{APP_TITLE}</h1>
                <p className="login-subtitle" style={{ color: 'var(--color-success, #3D8B5F)' }}>
                    ✓ Password updated
                </p>
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: 24 }}>
                    Your password has been changed successfully.
                </p>
                <button className="login-button" onClick={() => navigate('/login')}>
                    Sign in with new password
                </button>
            </div>
        );
    }

    return (
        <div className="login-container">
            <h1 className="login-title">{APP_TITLE}</h1>
            <p className="login-subtitle">Set a new password</p>

            <form onSubmit={handleSubmit}>
                <input
                    className="login-input"
                    placeholder="New password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    type="password"
                    autoComplete="new-password"
                />
                <input
                    className="login-input"
                    placeholder="Confirm new password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    type="password"
                    autoComplete="new-password"
                />

                {error && <p className="login-error">{error}</p>}

                <button className="login-button" type="submit" disabled={loading}>
                    {loading ? '…' : 'Set new password'}
                </button>
            </form>

            <button className="login-switch" onClick={() => navigate('/login')}>
                Back to sign in
            </button>
        </div>
    );
}
