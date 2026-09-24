import { useState } from 'react';
import { forgotPassword } from '../../api.js';

export default function ForgotPasswordScreen({ onGoLogin }) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [sent, setSent] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            await forgotPassword(email);
            setSent(true);
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
                <div className="auth-subtitle">Reset your password</div>
                {sent ? (
                    <div>
                        <div className="auth-success">Password reset email sent. Check your inbox and follow the link to reset your password.</div>
                        <div className="auth-links" style={{ marginTop: 16 }}>
                            <button className="auth-link" onClick={onGoLogin}>← Back to sign in</button>
                        </div>
                    </div>
                ) : (
                    <>
                        {error && <div className="auth-error">{error}</div>}
                        <form onSubmit={handleSubmit}>
                            <div className="form-row">
                                <label className="form-label">Email address</label>
                                <input
                                    className="admin-input"
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    autoComplete="email"
                                    required
                                />
                            </div>
                            <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
                                {loading ? 'Sending…' : 'Send reset link'}
                            </button>
                        </form>
                        <div className="auth-links">
                            <button className="auth-link" onClick={onGoLogin}>← Back to sign in</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
