import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../AuthContext';
import { ROLE_COLORS, DEFAULT_ROLE_COLOR } from '../theme';
import ProfilePopup from './ProfilePopup';

function capitalize(word) {
    if (!word) return '';
    return word.charAt(0).toUpperCase() + word.slice(1);
}

export default function RoleBadge() {
    const { userRole } = useAuth();
    const [open, setOpen] = useState(false);

    // Not logged in yet — render nothing (maintains layout space via parent min-width)
    if (!userRole) return null;

    const hasElevatedRole = userRole.level && userRole.level > 0;
    const color = ROLE_COLORS[userRole.role] || DEFAULT_ROLE_COLOR;

    return (
        <div style={{ position: 'relative' }}>
            {hasElevatedRole ? (
                <button
                    onClick={() => setOpen(o => !o)}
                    style={{
                        padding: '4px 10px',
                        borderRadius: 12,
                        marginRight: 12,
                        backgroundColor: color,
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                        display: 'inline-block',
                        border: 'none',
                        cursor: 'pointer',
                    }}
                    title="Profile"
                >
                    {capitalize(userRole.role)}
                </button>
            ) : (
                <button
                    onClick={() => setOpen(o => !o)}
                    style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        marginRight: 12,
                        background: 'var(--primary-light, #e8f5ee)',
                        border: '1.5px solid var(--primary, #3D8B5F)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                    }}
                    title="Profile"
                >
                    {/* Generic avatar: head circle + shoulder arc */}
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="8" cy="5.5" r="2.5" fill="var(--primary, #3D8B5F)" />
                        <path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="var(--primary, #3D8B5F)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                    </svg>
                </button>
            )}

            {open && createPortal(
                <ProfilePopup onClose={() => setOpen(false)} />,
                document.body
            )}
        </div>
    );
}
