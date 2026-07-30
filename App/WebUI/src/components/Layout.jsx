// components/Layout.jsx
import { Outlet } from 'react-router-dom';
import RoleBadge from './RoleBadge';
import '../styles/Layout.css';

export default function Layout() {
    return (
        <div>
            <header className="app-header">
                <RoleBadge />
            </header>
            <Outlet />
        </div>
    );
}