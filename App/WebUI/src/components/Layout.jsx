// components/Layout.jsx
import { Outlet, useLocation } from 'react-router-dom';
import RoleBadge from './RoleBadge';
import '../styles/Layout.css';

export default function Layout() {
    const location = useLocation();
    const showDashboardTitle = location.pathname === '/dashboard';

    return (
        <div className="app-shell">
            <header className="app-header">
                {showDashboardTitle && <h1 className="title app-header-title">Spending Pattern Visualisation Tool</h1>}
                <RoleBadge />
            </header>
            <div className="app-content">
                <Outlet />
            </div>
        </div>
    );
}