import { useApp } from '../AppContext';

const ROLE_COLORS = {
    owner: '#C4A227',
    admin: '#2E5C8A',
};
const DEFAULT_ROLE_COLOR = '#7A5C3D';

function capitalize(word) {
    if (!word) return '';
    return word.charAt(0).toUpperCase() + word.slice(1);
}

export default function RoleBadge() {
    const { userRole } = useApp();

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