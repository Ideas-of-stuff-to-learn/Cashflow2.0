import { useEffect, useState } from 'react';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../api.js';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal.jsx';

function CategoryModal({ category, onSave, onClose }) {
    const [name, setName] = useState(category?.name || '');
    const [color, setColor] = useState(category?.color || '#6c7fff');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function handleSave() {
        setSaving(true); setError('');
        try {
            await onSave({ name, color });
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
                <div className="modal-title">{category ? 'Edit Category' : 'Create Category'}</div>
                {error && <div className="screen-error">{error}</div>}
                <div className="form-row">
                    <label className="form-label">Name</label>
                    <input className="admin-input" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="form-row">
                    <label className="form-label">Colour</label>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 40, height: 34, border: 'none', background: 'none', cursor: 'pointer' }} />
                        <input className="admin-input" value={color} onChange={e => setColor(e.target.value)} style={{ maxWidth: 120, fontFamily: 'monospace' }} />
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

export default function CategoriesScreen() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [modal, setModal] = useState(null); // null | 'create' | category object
    const [deleteTarget, setDeleteTarget] = useState(null);

    useEffect(() => {
        getCategories()
            .then(setCategories)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    async function handleSave({ name, color }) {
        if (modal === 'create') {
            const cat = await createCategory(name, color);
            setCategories(prev => [...prev, cat]);
            setSuccess(`Category "${name}" created`);
        } else {
            const updated = await updateCategory(modal.id, { name, color });
            setCategories(prev => prev.map(c => c.id === modal.id ? updated : c));
            setSuccess(`Category "${name}" updated`);
        }
    }

    async function confirmDelete(cat) {
        setError(''); setSuccess('');
        await deleteCategory(cat.id);
        setCategories(prev => prev.filter(c => c.id !== cat.id));
        setSuccess(`Category "${cat.name}" deleted`);
    }

    return (
        <div>
            <h1 className="screen-title">Categories</h1>
            {error && <div className="screen-error">{error}</div>}
            {success && <div className="screen-success">{success}</div>}
            <div style={{ marginBottom: 16 }}>
                <button className="btn btn-primary" onClick={() => setModal('create')}>+ New Category</button>
            </div>
            {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : (
                <div className="admin-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Colour</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map(c => (
                                <tr key={c.id}>
                                    <td style={{ color: 'var(--text-muted)' }}>{c.id}</td>
                                    <td>{c.name}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span className="colour-swatch" style={{ background: c.color }} />
                                            <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{c.color}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="row-actions">
                                            <button className="btn btn-ghost btn-sm" onClick={() => setModal(c)}>Edit</button>
                                            <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(c)}>Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {deleteTarget && (
                <ConfirmDeleteModal
                    title={`Delete category "${deleteTarget.name}"`}
                    description={`This will permanently remove the "${deleteTarget.name}" category. Existing transactions assigned to it will become uncategorised.`}
                    onConfirm={() => confirmDelete(deleteTarget)}
                    onClose={() => setDeleteTarget(null)}
                />
            )}
            {modal && (
                <CategoryModal
                    category={modal === 'create' ? null : modal}
                    onSave={handleSave}
                    onClose={() => setModal(null)}
                />
            )}
        </div>
    );
}
