import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { verifyEmail } from '../api';
import '../styles/LoginScreen.css';

export default function VerifyEmailScreen() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('loading'); // loading | success | error
    const [message, setMessage] = useState('');

    useEffect(() => {
        const token = searchParams.get('token');
        if (!token) {
            setStatus('error');
            setMessage('No verification token found in the link. Make sure you copied the full URL.');
            return;
        }

        verifyEmail(token)
            .then(() => {
                setStatus('success');
                setMessage('Your email has been verified successfully.');
            })
            .catch(e => {
                setStatus('error');
                const code = e.code;
                if (code === 'token_used') {
                    setMessage('This verification link has already been used. Request a new one from your profile.');
                } else if (code === 'invalid_token') {
                    setMessage('This link is invalid or has expired (links expire after 5 minutes). Request a new one from your profile.');
                } else {
                    setMessage(e.message || 'Verification failed. Please try again.');
                }
            });
    }, []);

    return (
        <div className="login-container">
            <h1 className="login-title">Utility Tools</h1>

            {status === 'loading' && (
                <>
                    <p className="login-subtitle">Verifying your email…</p>
                    <div className="login-loading-wrap">
                        <div className="login-spinner-ring" />
                    </div>
                </>
            )}

            {status === 'success' && (
                <>
                    <p className="login-subtitle" style={{ color: 'var(--color-success, #3D8B5F)' }}>
                        ✓ Email verified
                    </p>
                    <p style={{ textAlign: 'center', marginBottom: 24, color: 'var(--text-secondary)' }}>{message}</p>
                    <button className="login-button" onClick={() => navigate('/login')}>
                        Continue to sign in
                    </button>
                </>
            )}

            {status === 'error' && (
                <>
                    <p className="login-subtitle">Verification failed</p>
                    <p className="login-error" style={{ textAlign: 'center', marginTop: 16 }}>{message}</p>
                    <button className="login-button" style={{ marginTop: 16 }} onClick={() => navigate('/login')}>
                        Back to sign in
                    </button>
                </>
            )}
        </div>
    );
}
