import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { cancelDeletion } from '../api';
import '../styles/LoginScreen.css';
import { APP_TITLE } from '../appTitle';

export default function CancelDeletionScreen() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        const token = searchParams.get('token');
        if (!token) {
            setStatus('error');
            setMessage('No cancellation token found. Make sure you used the full link from your email.');
            return;
        }
        cancelDeletion(token)
            .then(() => {
                setStatus('success');
                setMessage('Your account deletion has been cancelled. Everything is restored.');
            })
            .catch(e => {
                setStatus('error');
                if (e.code === 'invalid_token') {
                    setMessage('This link is invalid or has expired (48 hours). If your account was already deleted, contact support.');
                } else {
                    setMessage(e.message || 'Failed to cancel deletion. Please try again or contact support.');
                }
            });
    }, []);

    return (
        <div className="login-container">
            <h1 className="login-title">{APP_TITLE}</h1>

            {status === 'loading' && (
                <>
                    <p className="login-subtitle">Cancelling deletion…</p>
                    <div className="login-loading-wrap">
                        <div className="login-spinner-ring" />
                    </div>
                </>
            )}

            {status === 'success' && (
                <>
                    <p className="login-subtitle" style={{ color: 'var(--color-success, #3D8B5F)' }}>
                        ✓ Account restored
                    </p>
                    <p style={{ textAlign: 'center', marginBottom: 24, color: 'var(--text-secondary)' }}>{message}</p>
                    <button className="login-button" onClick={() => navigate('/login')}>
                        Sign in
                    </button>
                </>
            )}

            {status === 'error' && (
                <>
                    <p className="login-subtitle">Something went wrong</p>
                    <p className="login-error" style={{ textAlign: 'center', marginTop: 16 }}>{message}</p>
                    <button className="login-button" style={{ marginTop: 16 }} onClick={() => navigate('/login')}>
                        Back to sign in
                    </button>
                </>
            )}
        </div>
    );
}
