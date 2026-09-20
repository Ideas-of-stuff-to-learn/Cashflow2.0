import { useAuth } from '../appState';
import { ROLE_COLORS, DEFAULT_ROLE_COLOR } from '../theme';

function capitalize(word) {
    if (!word) return '';
    return word.charAt(0).toUpperCase() + word.slice(1);
}

export default function RoleBadge() {
    const { userRole } = useAuth();

    if (!userRole || !userRole.level) return null;

    const color = ROLE_COLORS[userRole.role] || DEFAULT_ROLE_COLOR;
    return (
        <span
            style={{
                padding: '4px 10px',
                borderRadius: 12,
                marginRight: 12,
                backgroundColor: color,
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                display: 'inline-block',
            }}
        >
            {capitalize(userRole.role)}
        </span>
    );
}
