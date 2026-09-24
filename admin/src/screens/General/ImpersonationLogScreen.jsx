import { useEffect, useState } from 'react';
import { getImpersonationLog, revokeToken } from '../../api.js';

export default function ImpersonationLogScreen() {
    const [log, setLog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [revoking, setRevoking] = useState(null);

    useEffect(() => {
        getImpersonationLog()
            .then(setLog)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    async function handleRevoke(jti) {
        setError(''); setSuccess('');
        setRevoking(jti);
        try {
            await revokeToken(jti);
            setSuccess(`Token ${jti.slice(0, 8)}… revoked`);
        } catch (e) {
            setError(e.message);
        } finally {
            setRevoking(null);
        }
    }

    function formatDate(iso) {
        return new Date(iso).toLocaleString();
    }

    return (
        <div>
            <h1 className="screen-title">Impersonation Log</h1>
            {error && <div className="screen-error">{error}</div>}
            {success && <div className="screen-success">{success}</div>}
            {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : (
                <div className="admin-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Actor</th>
                                <th>Target</th>
                                <th>JTI</th>
                                <th>When</th>
                                <th>Revoke</th>
                            </tr>
                        </thead>
                        <tbody>
                            {log.map(entry => (
                                <tr key={entry.id}>
                                    <td style={{ color: 'var(--text-muted)' }}>{entry.id}</td>
                                    <td>{entry.actor}</td>
                                    <td>{entry.target}</td>
                                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>
                                        {entry.jti.slice(0, 12)}…
                                    </td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatDate(entry.created_at)}</td>
                                    <td>
                                        <button
                                            className="btn btn-danger btn-sm"
                                            disabled={revoking === entry.jti}
                                            onClick={() => handleRevoke(entry.jti)}
                                        >
                                            {revoking === entry.jti ? 'Revoking…' : 'Revoke'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {log.length === 0 && (
                                <tr><td colSpan={6} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No entries</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
