import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, getMe } from '../api';
import { useApp } from '../AppContext';
import '../styles/LoginScreen.css'
import { POST_LOGIN_ROUTE } from '../config/routes';

// Progress bar easing: returns a % target given elapsed seconds.
// Deliberately slows near the top — bar sits at ~93% until getMe() responds.
function wakeupProgress(elapsedSeconds) {
    if (elapsedSeconds < 5)  return 4 + elapsedSeconds * 5.2;        // 4→30%
    if (elapsedSeconds < 15) return 30 + (elapsedSeconds - 5) * 4;   // 30→70%
    if (elapsedSeconds < 35) return 70 + (elapsedSeconds - 15) * 1;  // 70→90%
    return 90 + Math.min(3, (elapsedSeconds - 35) * 0.15);           // 90→93%, crawl
}

// Ordered boot stage messages — cycle through on a timer, independent of the bar.
// Deliberately generic: no implementation details, framework names, or architecture exposed.
const WAKEUP_STAGES = [
    'Starting up…',
    'Preparing server…',
    'Establishing secure connection…',
    'Loading application data…',
    'Running startup checks…',
    'Setting up services…',
    'Almost there…',
    'Finishing up…',
    'Getting things ready for you…',
    'Just a moment longer…',
];

export default function LoginScreen() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [checkingStoredSession, setCheckingStoredSession] = useState(true);
    const [retryCount, setRetryCount] = useState(0);
    const [isSlowStart, setIsSlowStart] = useState(false);
    const [progress, setProgress] = useState(0);
    const [spinnerFading, setSpinnerFading] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [stageIndex, setStageIndex] = useState(0);
    const wakeupStartRef = useRef(null);
    const progressRafRef = useRef(null);
    const stageIntervalRef = useRef(null);
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
        setIsSlowStart(false);
        setProgress(0);
        setSpinnerFading(false);
        setCompleting(false);
        setStageIndex(0);

        // After 3.5s with no response, transition to wakeup UI
        const slowTimer = setTimeout(() => {
            if (cancelled) return;
            setSpinnerFading(true);
            setTimeout(() => {
                if (cancelled) return;
                setIsSlowStart(true);
                wakeupStartRef.current = Date.now();
                // Kick off rAF loop to animate progress bar
                function tick() {
                    if (cancelled) return;
                    const elapsed = (Date.now() - wakeupStartRef.current) / 1000;
                    setProgress(wakeupProgress(elapsed));
                    progressRafRef.current = requestAnimationFrame(tick);
                }
                progressRafRef.current = requestAnimationFrame(tick);
                // Cycle stage text every 3.5s
                stageIntervalRef.current = setInterval(() => {
                    setStageIndex(i => Math.min(i + 1, WAKEUP_STAGES.length - 1));
                }, 3500);
            }, 400); // wait for spinner fade-out animation
        }, 3500);

        async function checkStoredSession() {
            try {
                const me = await getMe();
                if (cancelled) return;
                // Stop rAF, smoothly fill to 100% via CSS transition, then fade and navigate
                if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);
                setCompleting(true);
                setProgress(100);
                setTimeout(() => {
                    if (cancelled) return;
                    completeLogin(me.username);
                    navigate(POST_LOGIN_ROUTE, { replace: true });
                }, 1300); // 600ms fill + 700ms fade delay
            } catch (e) {
                if (cancelled) return;
                const msg = e.message || '';
                if (msg.includes('starting up')) {
                    setError(msg);
                } else {
                    console.log('[startup] No usable stored session:', msg);
                }
                setCheckingStoredSession(false);
            } finally {
                clearTimeout(slowTimer);
                if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);
                if (stageIntervalRef.current) clearInterval(stageIntervalRef.current);
            }
        }

        checkStoredSession();
        return () => {
            cancelled = true;
            clearTimeout(slowTimer);
            if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);
            if (stageIntervalRef.current) clearInterval(stageIntervalRef.current);
        };
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
            navigate(POST_LOGIN_ROUTE, { replace: true });
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
                        <button className="login-button" style={{ marginTop: 16, maxWidth: 280 }} onClick={() => setRetryCount(c => c + 1)}>
                            Retry
                        </button>
                    </>
                ) : isSlowStart ? (
                    <div className={`login-wakeup-wrap login-wakeup-fade-in${completing ? ' login-wakeup-done' : ''}`}>
                        <p className="login-wakeup-msg">
                            Server is waking up…
                            <span>This can take up to 2 minutes on first load</span>
                        </p>
                        <div className="login-progress-bar-row">
                            <div className="login-progress-track">
                                <div
                                    className={`login-progress-fill${completing ? ' login-progress-fill-complete' : ''}`}
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <span className="login-progress-pct">{Math.round(progress)}%</span>
                        </div>
                        <p key={stageIndex} className="login-progress-stage">{WAKEUP_STAGES[stageIndex]}</p>
                    </div>
                ) : (
                    <div className="login-loading-wrap">
                        <div className={`login-spinner-ring${spinnerFading ? ' login-spinner-fade-out' : ''}`} />
                    </div>
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
