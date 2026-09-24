import { NavLink } from 'react-router-dom';

const LANDING_URL = import.meta.env.PROD
    ? 'https://ideas-of-stuff-to-learn.github.io/utility-tools/'
    : 'http://localhost:5174/';

export default function Sidebar({ user }) {
    const displayName = user?.display_name || user?.username || '—';
    const role = user?.role || '';

    return (
        <nav className="admin-sidebar">
            <div className="admin-sidebar-header">
                <span className="admin-sidebar-title">Admin Panel</span>
                <span className="admin-sidebar-role">{role}</span>
            </div>

            <div className="admin-sidebar-user">{displayName}</div>

            <div className="admin-sidebar-section">General</div>
            <NavLink className="admin-nav-item" to="/general/users">Users</NavLink>
            <NavLink className="admin-nav-item" to="/general/roles">Roles &amp; Permissions</NavLink>
            <NavLink className="admin-nav-item" to="/general/unlock">Unlock Account</NavLink>
            <NavLink className="admin-nav-item" to="/general/impersonation-log">Impersonation Log</NavLink>

            <div className="admin-sidebar-section">Cashflow</div>
            <NavLink className="admin-nav-item" to="/cashflow/categories">Categories</NavLink>
            <NavLink className="admin-nav-item" to="/cashflow/user-transactions">User Transactions</NavLink>

            <a className="admin-nav-back" href={LANDING_URL}>← Back to utility-tools</a>
        </nav>
    );
}
