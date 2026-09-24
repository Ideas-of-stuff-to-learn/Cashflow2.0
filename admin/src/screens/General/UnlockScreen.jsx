import { useEffect, useState } from 'react';
import { getUsers, unlockUser } from '../../api.js';

export default function UnlockScreen() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [search, setSearch] = useState('');
    const [unlocking, setUnlocking] = useState(null);

    useEffect(() => {
        getUsers()
            .then(setUsers)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    async function handleUnlock(user) {
        setError(''); setSuccess('');
        setUnlocking(user.id);
        try {
            await unlockUser(user.id);
            setSuccess(`Account unlocked for "${user.username}"`);
        } catch (e) {
            setError(e.message);
        } finally {
            setUnlocking(null);
        }
    }

    const filtered = users.filter(u =>
        u.username.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <h1 className="screen-title">Unlock Account</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 13 }}>
                Unlocking clears login lockout and email rate-limit counters. Limits still apply normally after unlock.
            </p>
            {error && <div className="screen-error">{error}</div>}
            {success && <div className="screen-success">{success}</div>}
            <div className="admin-search-row">
                <input
                    className="admin-input"
                    placeholder="Search by username…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>
            {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : (
                <div className="admin-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Username</th>
                                <th>Role</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(u => (
                                <tr key={u.id}>
                                    <td style={{ color: 'var(--text-muted)' }}>{u.id}</td>
                                    <td>{u.username}</td>
                                    <td>{u.role}</td>
                                    <td>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            disabled={unlocking === u.id}
                                            onClick={() => handleUnlock(u)}
                                        >
                                            {unlocking === u.id ? 'Unlocking…' : 'Unlock'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
