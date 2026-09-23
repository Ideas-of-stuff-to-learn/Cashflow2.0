import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { forgotPassword } from '../api';
import '../styles/LoginScreen.css';
import { APP_TITLE } from '../appTitle';

export default function ForgotPasswordScreen() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const pageLoadRef = useRef(Date.now());
    const inFlightRef = useRef(false);

    async function handleSubmit(e) {
        e.preventDefault();

        if (inFlightRef.current) {
            setError('A request is already in progress.');
            return;
        }
        if (!email.trim()) {
            setError('Please enter your email address.');
            return;
        }

        inFlightRef.current = true;
        setLoading(true);
        setError(null);

        try {
            await forgotPassword(email.trim(), Date.now() - pageLoadRef.current);
            setSubmitted(true);
        } catch (e) {
            setError(e.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
            inFlightRef.current = false;
        }
    }

    if (submitted) {
        return (
            <div className="login-container">
                <h1 className="login-title">{APP_TITLE}</h1>
                <p className="login-subtitle">Check your inbox</p>
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: 24 }}>
                    If <strong>{email}</strong> is registered, you'll receive a reset link shortly.
                    The link expires in 5 minutes.
                </p>
                <button className="login-button" onClick={() => navigate('/login')}>
                    Back to sign in
                </button>
            </div>
        );
    }

    return (
        <div className="login-container">
            <h1 className="login-title">{APP_TITLE}</h1>
            <p className="login-subtitle">Reset your password</p>

            <form onSubmit={handleSubmit}>
                {/* Honeypot — hidden from real users, bots fill it */}
                <input
                    name="website"
                    type="text"
                    autoComplete="off"
                    tabIndex={-1}
                    style={{ display: 'none' }}
                    aria-hidden="true"
                />

                <input
                    className="login-input"
                    placeholder="Email address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    type="email"
                    autoCapitalize="none"
                    autoComplete="email"
                />

                {error && <p className="login-error">{error}</p>}

                <button className="login-button" type="submit" disabled={loading}>
                    {loading ? '…' : 'Send reset link'}
                </button>
            </form>

            <button className="login-switch" onClick={() => navigate('/login')}>
                Back to sign in
            </button>

            <footer className="login-legal-footer">
                <Link to="/privacy">Privacy</Link>
                <Link to="/terms">Terms</Link>
            </footer>
        </div>
    );
}
