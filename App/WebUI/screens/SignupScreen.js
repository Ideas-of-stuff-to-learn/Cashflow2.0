import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { signup } from '../api';
import { useApp } from '../AppContext.js';

export default function LoginScreen({ navigation }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { completeLogin } = useApp();

    async function handleSignup() {
        if (!username.trim() || !password.trim() || !confirmPassword.trim()) {
            setError('Please fill in all fields');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const trimmedUsername = username.trim();
            await signup(trimmedUsername, password);
            // signup() also stores a fresh token (same as login()) - see
            // api.js - so this is a genuine authenticated session from
            // here on, same gate as LoginScreen. A brand new account can
            // never match lastLoggedInUsernameRef from an old session
            // (the backend rejects duplicate usernames at signup), so
            // completeLogin will always wipe any leftover data here -
            // that's correct, a fresh signup should never inherit
            // anything from whoever used this device before.
            completeLogin(trimmedUsername);
            navigation.replace('Home');
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    return (
<View style={styles.container}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Sign up to get started</Text>

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

            <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor="#999"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSignup}
                disabled={loading}
            >
                {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.buttonText}>Create Account</Text>
                }
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.switchButton}
                onPress={() => navigation.navigate('Login')}
            >
                <Text style={styles.switchText}>Already have an account? Sign in</Text>
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