import { useEffect, useState } from 'react';
import { getRoles, getPermissions, createRole, updateRole, deleteRole } from '../../api.js';

function RoleModal({ role, allPermissions, onSave, onClose }) {
    const [name, setName] = useState(role?.name || '');
    const [level, setLevel] = useState(role?.level ?? '');
    const [selected, setSelected] = useState(new Set(role?.permissions || []));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    function togglePerm(key) {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }

    async function handleSave() {
        setSaving(true); setError('');
        try {
            await onSave({ name, level: parseInt(level, 10), permissions: [...selected] });
            onClose();
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="modal-backdrop">
            <div className="modal">
                <div className="modal-title">{role ? 'Edit Role' : 'Create Role'}</div>
                {error && <div className="screen-error">{error}</div>}
                <div className="form-row">
                    <label className="form-label">Name</label>
                    <input className="admin-input" value={name} onChange={e => setName(e.target.value)} disabled={!!role} />
                </div>
                <div className="form-row">
                    <label className="form-label">Level (higher = more powerful)</label>
                    <input className="admin-input" type="number" value={level} onChange={e => setLevel(e.target.value)} />
                </div>
                <div className="form-row">
                    <label className="form-label">Permissions</label>
                    <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {allPermissions.map(p => (
                            <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
                                <input type="checkbox" checked={selected.has(p.key)} onChange={() => togglePerm(p.key)} />
                                <span>{p.key}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>— {p.description}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div className="modal-actions">
                    <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function RolesScreen() {
    const [roles, setRoles] = useState([]);
    const [allPermissions, setAllPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [modal, setModal] = useState(null); // null | 'create' | role object

    useEffect(() => {
        Promise.all([getRoles(), getPermissions()])
            .then(([r, p]) => { setRoles(r); setAllPermissions(p); })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    async function handleSave({ name, level, permissions }) {
        if (modal === 'create') {
            const role = await createRole(name, level, permissions);
            setRoles(prev => [...prev, role]);
            setSuccess(`Role "${name}" created`);
        } else {
            const updated = await updateRole(modal.id, { level, permissions });
            setRoles(prev => prev.map(r => r.id === modal.id ? updated : r));
            setSuccess(`Role "${modal.name}" updated`);
        }
    }

    async function handleDelete(role) {
        if (!window.confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
        setError(''); setSuccess('');
        try {
            await deleteRole(role.id);
            setRoles(prev => prev.filter(r => r.id !== role.id));
            setSuccess(`Role "${role.name}" deleted`);
        } catch (e) {
            setError(e.message);
        }
    }

    return (
        <div>
            <h1 className="screen-title">Roles &amp; Permissions</h1>
            {error && <div className="screen-error">{error}</div>}
            {success && <div className="screen-success">{success}</div>}
            <div style={{ marginBottom: 16 }}>
                <button className="btn btn-primary" onClick={() => setModal('create')}>+ New Role</button>
            </div>
            {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : (
                <div className="admin-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Level</th>
                                <th>Permissions</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {roles.sort((a,b) => b.level - a.level).map(r => (
                                <tr key={r.id}>
                                    <td>{r.name}</td>
                                    <td>{r.level}</td>
                                    <td style={{ maxWidth: 400, fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-word' }}>
                                        {(r.permissions || []).join(', ') || '—'}
                                    </td>
                                    <td>
                                        <div className="row-actions">
                                            <button className="btn btn-ghost btn-sm" onClick={() => setModal(r)}>Edit</button>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r)}>Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {modal && (
                <RoleModal
                    role={modal === 'create' ? null : modal}
                    allPermissions={allPermissions}
                    onSave={handleSave}
                    onClose={() => setModal(null)}
                />
            )}
        </div>
    );
}
