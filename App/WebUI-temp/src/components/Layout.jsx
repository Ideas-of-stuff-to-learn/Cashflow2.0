// components/Layout.js
import { Outlet } from 'react-router-dom';
import RoleBadge from './RoleBadge';

export default function Layout() {
    return (
        <div>
            <header><RoleBadge /></header>
            <Outlet />
        </div>
    );
}