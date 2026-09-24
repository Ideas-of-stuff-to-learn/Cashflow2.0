import { useState } from 'react';
import { login } from '../../api.js';
import StartupScreen from '../../components/StartupScreen.jsx';

export default function LoginScreen({ onLogin, onGoSignup, onGoForgot }) {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e) {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            const data = await login(identifier, password);
            onLogin(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return <StartupScreen />;
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-title">Admin Panel</div>
                <div className="auth-subtitle">Sign in to your account</div>
                {error && <div className="auth-error">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-row">
                        <label className="form-label">Username or email</label>
                        <input
                            className="admin-input"
                            value={identifier}
                            onChange={e => setIdentifier(e.target.value)}
                            autoComplete="username"
                            required
                        />
                    </div>
                    <div className="form-row">
                        <label className="form-label">Password</label>
                        <input
                            className="admin-input"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            autoComplete="current-password"
                            required
                        />
                    </div>
                    <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
                        {loading ? 'Signing in…' : 'Sign in'}
                    </button>
                </form>
                <div className="auth-links">
                    <button className="auth-link" onClick={onGoForgot}>Forgot password?</button>
                    <button className="auth-link" onClick={onGoSignup}>Create account</button>
                </div>
            </div>
        </div>
    );
}
