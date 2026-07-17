import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { login } from '../api';
import { useApp } from '../AppContext.js';

export default function LoginScreen({ navigation }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { setIsLoggedIn } = useApp();

    async function handleLogin() {
        if (!username.trim() || !password.trim()) {
            setError('Please enter username and password');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await login(username.trim(), password);
            // Flip this BEFORE navigating, not after - it's what
            // AppContext's chartSummary effect is waiting on to make
            // its first fetch (see AppContext.js), and HomeScreen's own
            // initial-load effect fires the moment it mounts, so this
            // needs to already be true by the time navigation lands.
            setIsLoggedIn(true);
            navigation.replace('Home');
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
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