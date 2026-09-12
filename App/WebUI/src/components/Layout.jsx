// components/Layout.jsx
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import RoleBadge from './RoleBadge';
import '../styles/Layout.css';

export default function Layout() {
    const location = useLocation();
    const navigate = useNavigate();
    const isContents = location.pathname === '/contents';
    const isDashboard = location.pathname === '/dashboard';

    return (
        <div className="app-shell">
            <header className="app-header">
                {isDashboard && <h1 className="title app-header-title">Spending Pattern Visualisation Tool</h1>}
                {isDashboard
                    ? null
                    : isContents
                        ? <button className="app-header-back-btn" onClick={() => navigate('/dashboard')}>← Dashboard</button>
                        : <div />
                }
                {isContents && <span className="app-header-page-title">Transactions</span>}
                <RoleBadge />
            </header>
            <div className="app-content">
                <Outlet />
            </div>
        </div>
    );
}