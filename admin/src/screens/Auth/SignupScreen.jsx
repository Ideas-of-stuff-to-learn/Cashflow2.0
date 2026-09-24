import { useState } from 'react';
import { signup } from '../../api.js';

export default function SignupScreen({ onLogin, onGoLogin }) {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e) {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            const data = await signup(username, password, email || undefined);
            onLogin(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-title">Admin Panel</div>
                <div className="auth-subtitle">Create an account</div>
                <div className="auth-notice">New accounts start with no admin access. An existing admin must grant you the required role.</div>
                {error && <div className="auth-error">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-row">
                        <label className="form-label">Username</label>
                        <input
                            className="admin-input"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            autoComplete="username"
                            required
                        />
                    </div>
                    <div className="form-row">
                        <label className="form-label">Email <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                        <input
                            className="admin-input"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            autoComplete="email"
                        />
                    </div>
                    <div className="form-row">
                        <label className="form-label">Password</label>
                        <input
                            className="admin-input"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            autoComplete="new-password"
                            required
                        />
                    </div>
                    <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
                        {loading ? 'Creating account…' : 'Create account'}
                    </button>
                </form>
                <div className="auth-links">
                    <button className="auth-link" onClick={onGoLogin}>Already have an account? Sign in</button>
                </div>
            </div>
        </div>
    );
}
