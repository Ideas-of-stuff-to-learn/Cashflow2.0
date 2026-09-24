import { useState } from 'react';

/**
 * Requires the user to type a confirmation word before deleting.
 * Props:
 *   title       - modal heading
 *   description - what is being deleted (shown as body text)
 *   confirmWord - the word the user must type (default "DELETE")
 *   onConfirm   - async fn called when confirmed
 *   onClose     - fn called on cancel
 */
export default function ConfirmDeleteModal({ title, description, confirmWord = 'DELETE', onConfirm, onClose }) {
    const [value, setValue] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function handleConfirm() {
        if (value !== confirmWord) {
            setError(`Type ${confirmWord} to confirm.`);
            return;
        }
        setSaving(true);
        setError('');
        try {
            await onConfirm();
            onClose();
        } catch (e) {
            setError(e.message);
            setSaving(false);
        }
    }

    return (
        <div className="modal-backdrop">
            <div className="modal" style={{ maxWidth: 420 }}>
                <div className="modal-title" style={{ color: 'var(--danger)' }}>{title}</div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '8px 0 16px' }}>{description}</p>
                <div className="form-row">
                    <label className="form-label">
                        Type <strong style={{ color: 'var(--text)' }}>{confirmWord}</strong> to confirm
                    </label>
                    <input
                        className="admin-input"
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                        autoFocus
                        placeholder={confirmWord}
                    />
                </div>
                {error && <div className="screen-error" style={{ marginTop: 8 }}>{error}</div>}
                <div className="modal-actions">
                    <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
                    <button
                        className="btn btn-danger"
                        onClick={handleConfirm}
                        disabled={saving || value !== confirmWord}
                    >
                        {saving ? 'Deleting…' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
}
