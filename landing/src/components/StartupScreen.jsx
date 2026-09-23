import { useState, useEffect, useRef } from 'react';
import '../styles/LoginScreen.css';

function wakeupProgress(elapsedSeconds) {
    if (elapsedSeconds < 5)  return 4 + elapsedSeconds * 5.2;
    if (elapsedSeconds < 15) return 30 + (elapsedSeconds - 5) * 4;
    if (elapsedSeconds < 35) return 70 + (elapsedSeconds - 15) * 1;
    return 90 + Math.min(3, (elapsedSeconds - 35) * 0.15);
}

const WAKEUP_STAGES = [
    'Starting up…', 'Preparing server…', 'Establishing secure connection…',
    'Loading application data…', 'Running startup checks…', 'Setting up services…',
    'Initialising core systems…', 'Configuring application…', 'Loading user services…',
    'Preparing data layer…', 'Verifying system integrity…', 'Setting up secure session handling…',
    'Loading transaction services…', 'Preparing categorisation engine…', 'Bringing services online…',
    'Completing system checks…', 'Finalising configuration…', 'Almost there…',
    'Activating services…', 'Loading your workspace…', 'Warming up…',
    'Checking service health…', 'Preparing your environment…', 'Systems coming online…',
    'Synchronising services…', 'Nearly ready…', 'Finishing startup sequence…',
    'Last few checks…', 'Getting things ready for you…', 'Applying final configuration…',
    'Services are responding…', 'Just a moment longer…', 'Almost ready now…',
    'Hang tight…', 'Wrapping up…',
];

export default function StartupScreen() {
    const [isSlowStart, setIsSlowStart] = useState(false);
    const [progress, setProgress] = useState(0);
    const [spinnerFading, setSpinnerFading] = useState(false);
    const [stageIndex, setStageIndex] = useState(0);
    const wakeupStartRef = useRef(null);
    const progressRafRef = useRef(null);
    const stageIntervalRef = useRef(null);

    useEffect(() => {
        let cancelled = false;

        const slowTimer = setTimeout(() => {
            if (cancelled) return;
            setSpinnerFading(true);
            setTimeout(() => {
                if (cancelled) return;
                setIsSlowStart(true);
                wakeupStartRef.current = Date.now();
                function tick() {
                    if (cancelled) return;
                    const elapsed = (Date.now() - wakeupStartRef.current) / 1000;
                    setProgress(wakeupProgress(elapsed));
                    progressRafRef.current = requestAnimationFrame(tick);
                }
                progressRafRef.current = requestAnimationFrame(tick);
                stageIntervalRef.current = setInterval(() => {
                    setStageIndex(i => (i + 1) % WAKEUP_STAGES.length);
                }, 3500);
            }, 400);
        }, 3500);

        return () => {
            cancelled = true;
            clearTimeout(slowTimer);
            if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);
            if (stageIntervalRef.current) clearInterval(stageIntervalRef.current);
        };
    }, []);

    return (
        <div className="login-container">
            {isSlowStart ? (
                <div className="login-wakeup-wrap login-wakeup-fade-in">
                    <p className="login-wakeup-msg">
                        Server is waking up…
                        <span>This can take up to 2 minutes on first load</span>
                    </p>
                    <div className="login-progress-bar-row">
                        <div className="login-progress-track">
                            <div
                                className="login-progress-fill"
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
