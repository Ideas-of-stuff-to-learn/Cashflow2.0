import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { login, getToken, getMe } from '../api';
import { useApp } from '../AppContext.js';

export default function LoginScreen({ navigation }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // True while the on-mount stored-session check below is running -
    // shows a spinner INSTEAD of the login form, so someone with a
    // perfectly good saved session never sees a login form flash up
    // and vanish (or worse, starts typing into it) during the check.
    const [checkingStoredSession, setCheckingStoredSession] = useState(true);
    const [retryCount, setRetryCount] = useState(0);
    const { completeLogin } = useApp();

    // The piece that makes "stay logged in across app restarts"
    // actually WORK. Tokens were already being saved to SecureStore
    // (persistent, survives the app fully closing) and the 24h/30-day
    // expiry + silent-refresh machinery already existed in api.js -
    // but App.js unconditionally starts at this Login screen, and
    // nothing ever checked for an existing session, so every cold
    // start demanded a fresh password no matter what. This checks.
    //
    // getMe() rather than just "does a token exist locally" on
    // purpose: a locally-present token can still be DEAD (revoked via
    // logout elsewhere, or the 30-day refresh window ran out). getMe()
    // goes through api.js's authorizedFetch, which on a 401
    // automatically attempts the silent refresh-and-retry - so this
    // one call validates the ENTIRE chain: access token still good ->
    // straight in; access expired but refresh good -> silently renewed,
    // straight in; everything dead -> throws, and the normal login
    // form is shown, exactly as before.
    //
    // retryCount in the dependency array re-runs this effect when the
    // user taps Retry after a cold-start timeout.
    useEffect(() => {
        let cancelled = false;
        setError(null);
        setCheckingStoredSession(true);

        async function checkStoredSession() {
            try {
                const token = await getToken();
                if (!token) return; // nothing saved - show the form

                const me = await getMe();
                if (cancelled) return;

                // Same call-order requirement as handleLogin below:
                // completeLogin BEFORE navigating - see that comment.
                completeLogin(me.username);
                navigation.replace('Home');
            } catch (e) {
                if (cancelled) return;
                const msg = e.message || '';
                if (msg.includes('starting up')) {
                    // The server is cold-starting, not the session being
                    // dead - surface the message so the user knows to
                    // wait, and show a retry button rather than just
                    // the login form (which would demand a password for
                    // a session that's actually still valid).
                    setError(msg);
                } else {
                    // Genuinely dead session (revoked, expired past
                    // refresh window, etc.) - silently show the login
                    // form, needing to log in is normal behaviour here.
                    console.log('[startup] No usable stored session:', msg);
                }
            } finally {
                if (!cancelled) setCheckingStoredSession(false);
            }
        }

        checkStoredSession();
        return () => { cancelled = true; };
    }, [retryCount]);

    async function handleLogin() {
        if (!username.trim() || !password.trim()) {
            setError('Please enter username and password');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const trimmedUsername = username.trim();
            await login(trimmedUsername, password);
            // Call this BEFORE navigating, not after - it's what
            // AppContext's chartSummary effect is waiting on to make
            // its first fetch (see AppContext.js), and HomeScreen's own
            // initial-load effect fires the moment it mounts, so this
            // needs to already be done by the time navigation lands.
            // completeLogin also decides whether to wipe leftover data
            // from a previous session, based on whether this is the
            // same username as last time - see the comment on it in
            // AppContext.js.
            completeLogin(trimmedUsername);
            navigation.replace('Home');
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    // Still checking for a saved session - spinner only, no form yet.
    // Brief when the server's awake; can last longer if this request
    // is the one that wakes a spun-down free-tier instance, which is
    // exactly when a login form flashing up mid-check would be most
    // confusing ("do I type my password or not?").
    if (checkingStoredSession) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>Transaction Categorizer</Text>
                {error ? (
                    <>
                        <Text style={[styles.error, { textAlign: 'center', marginTop: 24 }]}>{error}</Text>
                        <TouchableOpacity
                            style={[styles.button, { marginTop: 16 }]}
                            onPress={() => setRetryCount(c => c + 1)}
                        >
                            <Text style={styles.buttonText}>Retry</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <ActivityIndicator size="large" color="#2E5C8A" style={{ marginTop: 24 }} />
                )}
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Transaction Categorizer</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>

            <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor="#999"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
            />

            <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
            >
                {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.buttonText}>Sign in</Text>
                }
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.switchButton}
                onPress={() => navigation.navigate('Signup')}
            >
                <Text style={styles.switchText}>Don't have an account? Sign up</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 24 },
    title: { fontSize: 26, fontWeight: 'bold', marginBottom: 8 },
    subtitle: { fontSize: 16, color: '#555', marginBottom: 32 },
    input: { width: '100%', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12, color: '#333' },
    error: { color: '#D94F4F', marginBottom: 12, fontSize: 14 },
    button: { width: '100%', backgroundColor: '#2E5C8A', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    switchButton: { marginTop: 16 },
    switchText: { color: '#2E5C8A', fontSize: 14 },
});