import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { getChartSummary } from './api.js';

const AppContext = createContext();

export function AppProvider({ children }) {
    const [transactions, setTransactions] = useState([]);
    const [categorising, setCategorising] = useState(false);
    const [parseError, setParseError] = useState(null);
    const [categories, setCategories] = useState([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [processingStage, setProcessingStage] = useState('idle');

    // processingStage only has a handful of values for an entire run
    // (idle -> parsing -> checkingCache -> waitingForLLM -> done) and
    // doesn't change per chunk - useFileProcessor.js can work through
    // many separate cache/LLM batches while stuck on the SAME stage
    // value the whole time. Anything that needs to know "the DB
    // changed in a way that affects chart totals" (see the
    // chartSummary effect below) needs something finer-grained than
    // processingStage - this ticks up once per categorisation chunk
    // (cache or LLM), AND on any other DB-changing action that should
    // refresh the charts (e.g. deleting transactions - see
    // ContentsScreen.js). Not tied to categorisation specifically
    // despite the name's history - anything that changes what charts
    // should show bumps this.
    const [chartDataVersion, setChartDataVersion] = useState(0);
    const bumpChartDataVersion = useCallback(() => {
        setChartDataVersion(t => t + 1);
    }, []);

    // Whether an authenticated session currently exists. Starts false -
    // AppProvider mounts the whole app, including the Login screen
    // itself, so anything in this provider that fetches from an
    // authenticated endpoint (chartSummary, below) must not run until
    // LoginScreen/SignupScreen call completeLogin() (below) right after
    // a successful login/signup call. useLogout.js calls endSession()
    // to flip it back to false on logout.
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    // Chart summary lives HERE, at the provider level, not inside
    // ChartsScreen/useChartData - deliberately. ChartsScreen is a stack
    // screen; navigation.goBack() fully UNMOUNTS it, and navigating
    // back to it mounts a fresh instance with fresh (empty) state. If
    // the summary lived there, every quick Home <-> Charts round trip
    // would: reset to empty, kick off a new fetch, and then likely get
    // unmounted again (cancelling that fetch, per the cleanup function)
    // before it ever resolves if the user navigates away again first -
    // which looks exactly like "Charts never updates", when what's
    // actually happening is every fetch keeps getting thrown away
    // before it lands. Keeping it here means it fetches in the
    // background continuously regardless of which screen is currently
    // mounted, and ChartsScreen just reads whatever's already there the
    // moment it mounts - no race, nothing to lose to a quick back-and-forth.
    const [chartSummary, setChartSummary] = useState({ yearly: [], monthly: [] });

    useEffect(() => {
        // AppProvider (and this effect) is alive for the ENTIRE app
        // lifetime, including the Login/Signup screens themselves -
        // there is no "logged in" gate around AppProvider in App.js.
        // Without this check, chartDataVersion's initial value (0) was
        // enough to fire this effect the instant the app opened, well
        // before any credentials existed, so getChartSummary() 401'd
        // immediately - burning the retry budget below on a call that
        // was never going to succeed - and then sat there doing
        // nothing until something else happened to bump
        // chartDataVersion (a login flowing into an upload). Now it
        // simply doesn't run at all until isLoggedIn flips true, which
        // LoginScreen/SignupScreen do right after their login()/signup()
        // call succeeds - and because isLoggedIn is itself a dependency
        // here, that flip is exactly what triggers the first real fetch,
        // no separate kickoff needed.
        if (!isLoggedIn) return;

        let cancelled = false;

        // A failed fetch here used to just warn and give up - fine
        // most of the time, since the NEXT tick would fetch again
        // anyway. But if the failure happens on the LAST tick of a
        // run (nothing left to trigger another attempt), the chart is
        // silently stuck one batch stale with no way to recover short
        // of another upload or an app restart. A short retry-with-
        // backoff covers exactly that case, for whatever transient
        // reason the fetch failed (seen once after a dev bundle
        // reload landed mid-flight and the very next SecureStore read
        // came back empty for a moment - but this guards against any
        // one-off blip, not just that specific cause).
        async function fetchWithRetry(attempt = 1) {
            try {
                const data = await getChartSummary();
                if (!cancelled) setChartSummary(data);
            } catch (e) {
                if (attempt >= 3) {
                    console.warn(`Failed to load chart summary after ${attempt} attempts:`, e.message);
                    return;
                }
                const delayMs = 1000 * attempt;
                await new Promise(resolve => setTimeout(resolve, delayMs));
                if (!cancelled) await fetchWithRetry(attempt + 1);
            }
        }

        fetchWithRetry();

        return () => { cancelled = true; };
    }, [chartDataVersion, isLoggedIn]);

    const categoryNames = categories.map(c => c.name);
    const categoryColors = Object.fromEntries(categories.map(c => [c.name, c.color]));

    // Tracks the username of whoever last completed a login in THIS APP
    // INSTANCE - not persisted anywhere, resets to null on every app
    // relaunch, which is exactly the scope we want: "does the person
    // currently logging in match the person who was using this device a
    // moment ago", not anything that needs to survive a restart. A ref,
    // not state - nothing ever needs to re-render off this value, it's
    // pure bookkeeping read only inside completeLogin below.
    const lastLoggedInUsernameRef = useRef(null);

    // Called by LoginScreen/SignupScreen right after their login()/
    // signup() call succeeds - this is what actually flips isLoggedIn
    // true (see the chartSummary effect above, which is waiting on it).
    //
    // Before doing that, it decides whether the PREVIOUS account's data
    // (transactions/categories/chartSummary, still sitting in state
    // from before logout - see endSession below) is safe to leave on
    // screen for a moment while the fresh fetch runs, or needs wiping
    // first:
    //   - Same username as last time -> leave it. It's the same
    //     person's own data; the normal post-login fetch will overwrite
    //     it with current data anyway (same as any other refresh in
    //     this app), so there's nothing to protect against, and skipping
    //     the wipe avoids an unnecessary blank-screen flash between
    //     logout and the fetch landing.
    //   - Different username (or no prior login this session) -> wipe
    //     immediately, synchronously, before isLoggedIn even flips - a
    //     second account must never render a single frame of the first
    //     account's numbers.
    //
    // Comparison is case-sensitive and NOT normalized beyond what the
    // caller already passes in - backend.py treats usernames as exact
    // strings (`WHERE username = %s`, no lowercasing anywhere in
    // auth), so lowercasing here would wrongly treat two distinct
    // accounts ("Bob" vs "bob") as the same person and leave one
    // account's data showing under the other's session.
    const completeLogin = useCallback((username) => {
        if (username !== lastLoggedInUsernameRef.current) {
            setChartSummary({ yearly: [], monthly: [] });
            setTransactions([]);
            setCategories([]);
        }
        lastLoggedInUsernameRef.current = username;
        setIsLoggedIn(true);
    }, []);

    // Called by useLogout.js right before it clears the stored token.
    // Only flips isLoggedIn false - stops the chartSummary effect from
    // firing again on this now-stale session. Deliberately does NOT
    // clear transactions/categories/chartSummary here anymore: that
    // decision now happens at the START of the NEXT login instead (see
    // completeLogin above), based on whether it's the same person
    // logging back in. Doing it here unconditionally would blank the
    // screen for a moment on every single logout, even the extremely
    // common case of the same person immediately logging back in.
    const endSession = useCallback(() => {
        setIsLoggedIn(false);
    }, []);

    return (
        <AppContext.Provider value={{
            transactions,
            setTransactions,
            categorising,
            setCategorising,
            parseError,
            setParseError,
            categories,
            setCategories,
            categoryNames,
            categoryColors,
            initialLoading,
            setInitialLoading,
            processingStage,
            setProcessingStage,
            chartDataVersion,
            bumpChartDataVersion,
            chartSummary,
            isLoggedIn,
            completeLogin,
            endSession,
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    return useContext(AppContext);
}