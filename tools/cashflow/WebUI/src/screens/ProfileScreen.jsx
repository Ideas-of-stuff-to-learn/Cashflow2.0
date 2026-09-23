import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../appState';
import {
    updateProfile, changePassword, deleteAccount,
    sendVerificationEmail, logout,
} from '../api';
import '../styles/ProfileScreen.css';

export default function ProfileScreen() {
    const { userRole, endSession } = useAuth();
    const navigate = useNavigate();

    // Display name
    const [displayName, setDisplayName] = useState('');
    const [savingName, setSavingName] = useState(false);
    const [nameMsg, setNameMsg] = useState(null); // {text, ok}

    // Email change
    const [newEmail, setNewEmail] = useState('');
    const [savingEmail, setSavingEmail] = useState(false);
    const [emailMsg, setEmailMsg] = useState(null);
    const [emailSendCount, setEmailSendCount] = useState(0);

    // Verification resend
    const [resending, setResending] = useState(false);
    const [resendMsg, setResendMsg] = useState(null);

    // Password change
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [savingPw, setSavingPw] = useState(false);
    const [pwMsg, setPwMsg] = useState(null);

    // Delete account
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [deleteMsg, setDeleteMsg] = useState(null);
    const [showDeleteForm, setShowDeleteForm] = useState(false);

    const pageLoadRef = useRef(Date.now());

    useEffect(() => {
        if (userRole) {
            setDisplayName(userRole.display_name || userRole.username || '');
        }
    }, [userRole]);

    const email = userRole?.email;
    const emailVerified = userRole?.email_verified;
    const pendingEmail = userRole?.pending_email;
    const EMAIL_DAILY_CAP = 5;

    async function handleSaveName(e) {
        e.preventDefault();
        if (!displayName.trim()) return;
        setSavingName(true);
        setNameMsg(null);
        try {
            await updateProfile({ display_name: displayName.trim() });
            setNameMsg({ text: 'Display name updated.', ok: true });
        } catch (err) {
            setNameMsg({ text: err.message || 'Failed to update name.', ok: false });
        } finally {
            setSavingName(false);
        }
    }

    async function handleChangeEmail(e) {
        e.preventDefault();
        if (!newEmail.trim()) return;
        setSavingEmail(true);
        setEmailMsg(null);
        try {
            await updateProfile({ email: newEmail.trim() });
            setEmailSendCount(c => c + 1);
            setEmailMsg({ text: `Verification email sent to ${newEmail.trim()}. Check your inbox — the link expires in 5 minutes.`, ok: true });
            setNewEmail('');
        } catch (err) {
            setEmailMsg({ text: err.message || 'Failed to update email.', ok: false });
        } finally {
            setSavingEmail(false);
        }
    }

    async function handleResendVerification() {
        if (resending) return;
        setResending(true);
        setResendMsg(null);
        try {
            await sendVerificationEmail();
            setEmailSendCount(c => c + 1);
            setResendMsg({ text: 'Verification email sent. Check your inbox.', ok: true });
        } catch (err) {
            setResendMsg({ text: err.message || 'Failed to resend.', ok: false });
        } finally {
            setResending(false);
        }
    }

    async function handleChangePassword(e) {
        e.preventDefault();
        if (!currentPw || !newPw || !confirmPw) { setPwMsg({ text: 'Please fill in all fields.', ok: false }); return; }
        if (newPw !== confirmPw) { setPwMsg({ text: 'New passwords do not match.', ok: false }); return; }
        if (newPw.length < 8) { setPwMsg({ text: 'Password must be at least 8 characters.', ok: false }); return; }
        setSavingPw(true);
        setPwMsg(null);
        try {
            await changePassword(currentPw, newPw);
            setPwMsg({ text: 'Password changed successfully.', ok: true });
            setCurrentPw(''); setNewPw(''); setConfirmPw('');
        } catch (err) {
            setPwMsg({ text: err.message || 'Failed to change password.', ok: false });
        } finally {
            setSavingPw(false);
        }
    }

    async function handleDeleteAccount(e) {
        e.preventDefault();
        if (deleteConfirm !== 'DELETE') { setDeleteMsg({ text: 'Type DELETE to confirm.', ok: false }); return; }
        setDeleting(true);
        setDeleteMsg(null);
        try {
            await deleteAccount();
            await logout();
            endSession();
            navigate('/login', { replace: true });
        } catch (err) {
            setDeleteMsg({ text: err.message || 'Failed to schedule deletion.', ok: false });
            setDeleting(false);
        }
    }

    const atEmailCap = emailSendCount >= EMAIL_DAILY_CAP;
    const nearEmailCap = emailSendCount === EMAIL_DAILY_CAP - 1;

    return (
        <div className="profile-page">
            <div className="profile-back">
                <button className="profile-back-btn" onClick={() => navigate(-1)}>← Back</button>
            </div>

            <div className="profile-card">
                <h1 className="profile-title">Profile</h1>

                {/* ── Display name ── */}
                <section className="profile-section">
                    <h2 className="profile-section-heading">Display name</h2>
                    <form onSubmit={handleSaveName} className="profile-row">
                        <input
                            className="profile-input"
                            value={displayName}
                            onChange={e => setDisplayName(e.target.value)}
                            placeholder="Display name"
                            maxLength={50}
                        />
                        <button className="profile-btn-save" type="submit" disabled={savingName}>
                            {savingName ? '…' : 'Save'}
                        </button>
                    </form>
                    {nameMsg && <p className={`profile-msg ${nameMsg.ok ? 'ok' : 'err'}`}>{nameMsg.text}</p>}
                </section>

                {/* ── Email ── */}
                <section className="profile-section">
                    <h2 className="profile-section-heading">Email</h2>

                    {email ? (
                        <div className="profile-email-current">
                            <span className="profile-email-addr">{email}</span>
                            {emailVerified
                                ? <span className="profile-email-badge verified">✓ verified</span>
                                : <span className="profile-email-badge unverified">unverified</span>}
                        </div>
                    ) : (
                        <p className="profile-email-none">No email address on your account.</p>
                    )}

                    {pendingEmail && (
                        <p className="profile-pending-note">
                            Pending change to <strong>{pendingEmail}</strong> — check your inbox to verify.
                        </p>
                    )}

                    {email && !emailVerified && (
                        <div className="profile-resend-wrap">
                            {nearEmailCap && <p className="profile-warn">1 send remaining today.</p>}
                            {atEmailCap
                                ? <p className="profile-warn">Daily email limit reached. Try again tomorrow.</p>
                                : <button className="profile-btn-secondary" onClick={handleResendVerification} disabled={resending}>
                                    {resending ? '…' : 'Resend verification email'}
                                  </button>
                            }
                            {resendMsg && <p className={`profile-msg ${resendMsg.ok ? 'ok' : 'err'}`}>{resendMsg.text}</p>}
                        </div>
                    )}

                    <form onSubmit={handleChangeEmail} className="profile-row" style={{ marginTop: 12 }}>
                        <input
                            className="profile-input"
                            type="email"
                            value={newEmail}
                            onChange={e => setNewEmail(e.target.value)}
                            placeholder={email ? 'New email address' : 'Add email address'}
                        />
                        {atEmailCap
                            ? <span className="profile-btn-save profile-btn-disabled">Limit reached</span>
                            : <button className="profile-btn-save" type="submit" disabled={savingEmail || !newEmail.trim()}>
                                {savingEmail ? '…' : (email ? 'Change' : 'Add')}
                              </button>
                        }
                    </form>
                    {nearEmailCap && !atEmailCap && <p className="profile-warn" style={{ marginTop: 4 }}>1 send remaining today.</p>}
                    {emailMsg && <p className={`profile-msg ${emailMsg.ok ? 'ok' : 'err'}`}>{emailMsg.text}</p>}
                </section>

                {/* ── Password ── */}
                <section className="profile-section">
                    <h2 className="profile-section-heading">Password</h2>
                    <form onSubmit={handleChangePassword} className="profile-col">
                        <input className="profile-input" type="password" placeholder="Current password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} autoComplete="current-password" />
                        <input className="profile-input" type="password" placeholder="New password" value={newPw} onChange={e => setNewPw(e.target.value)} autoComplete="new-password" />
                        <input className="profile-input" type="password" placeholder="Confirm new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} autoComplete="new-password" />
                        {pwMsg && <p className={`profile-msg ${pwMsg.ok ? 'ok' : 'err'}`}>{pwMsg.text}</p>}
                        <button className="profile-btn-save" type="submit" disabled={savingPw} style={{ alignSelf: 'flex-start' }}>
                            {savingPw ? '…' : 'Change password'}
                        </button>
                    </form>
                </section>

                {/* ── Danger zone ── */}
                <section className="profile-section profile-danger-zone">
                    <h2 className="profile-section-heading danger">Danger zone</h2>
                    {!showDeleteForm ? (
                        <button className="profile-btn-danger" onClick={() => setShowDeleteForm(true)}>
                            Delete account
                        </button>
                    ) : (
                        <form onSubmit={handleDeleteAccount} className="profile-col">
                            <p className="profile-delete-warning">
                                Your account and all data will be <strong>permanently deleted in 48 hours</strong>.
                                You'll receive an email with a link to cancel within that window.
                            </p>
                            <input
                                className="profile-input profile-input-danger"
                                placeholder='Type DELETE to confirm'
                                value={deleteConfirm}
                                onChange={e => setDeleteConfirm(e.target.value)}
                                autoComplete="off"
                            />
                            {deleteMsg && <p className={`profile-msg err`}>{deleteMsg.text}</p>}
                            <div className="profile-row">
                                <button className="profile-btn-danger" type="submit" disabled={deleting}>
                                    {deleting ? '…' : 'Confirm deletion'}
                                </button>
                                <button className="profile-btn-secondary" type="button" onClick={() => { setShowDeleteForm(false); setDeleteConfirm(''); setDeleteMsg(null); }}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}
                </section>
            </div>
        </div>
    );
}
