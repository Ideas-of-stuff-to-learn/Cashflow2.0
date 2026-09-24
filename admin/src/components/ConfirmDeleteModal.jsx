import { useState } from 'react';

/**
 * Requires the user to type a confirmation word before scheduling a soft-delete.
 * After confirmation shows a grace-period notice instead of closing immediately.
 */
export default function ConfirmDeleteModal({ title, description, confirmWord = 'DELETE', onConfirm, onClose }) {
    const [value, setValue] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [scheduled, setScheduled] = useState(false);

    async function handleConfirm() {
        if (value !== confirmWord) {
            setError(`Type ${confirmWord} to confirm.`);
            return;
        }
        setSaving(true);
        setError('');
        try {
            await onConfirm();
            setScheduled(true);
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    }

    if (scheduled) {
        return (
            <div className="modal-backdrop">
                <div className="modal" style={{ maxWidth: 420 }}>
                    <div className="modal-title" style={{ color: 'var(--warning)' }}>Deletion scheduled</div>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '8px 0 8px' }}>
                        This will be permanently deleted in <strong style={{ color: 'var(--text)' }}>48 hours</strong>.
                        You will receive an email confirmation once it's gone.
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px' }}>
                        To reverse this, click <strong style={{ color: 'var(--text)' }}>Cancel deletion</strong> on the item before the 48 hours are up.
                    </p>
                    <div className="modal-actions">
                        <button className="btn btn-primary" onClick={onClose}>Got it</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="modal-backdrop">
            <div className="modal" style={{ maxWidth: 420 }}>
                <div className="modal-title" style={{ color: 'var(--danger)' }}>{title}</div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '8px 0 4px' }}>{description}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>
                    Deletion is not immediate — you will have <strong style={{ color: 'var(--text)' }}>48 hours</strong> to reverse this decision.
                </p>
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
                        {saving ? 'Scheduling…' : 'Schedule deletion'}
                    </button>
                </div>
            </div>
        </div>
    );
}
