import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { getMe } from './api.js';
import Sidebar from './components/Sidebar.jsx';
import UsersScreen from './screens/General/UsersScreen.jsx';
import RolesScreen from './screens/General/RolesScreen.jsx';
import UnlockScreen from './screens/General/UnlockScreen.jsx';
import ImpersonationLogScreen from './screens/General/ImpersonationLogScreen.jsx';
import CategoriesScreen from './screens/Cashflow/CategoriesScreen.jsx';
import UserTransactionsScreen from './screens/Cashflow/UserTransactionsScreen.jsx';

const LANDING_URL = import.meta.env.PROD
    ? 'https://ideas-of-stuff-to-learn.github.io/utility-tools/'
    : 'http://localhost:5174/';

function AdminApp({ user }) {
    return (
        <div className="admin-layout">
            <Sidebar user={user} />
            <main className="admin-main">
                <Routes>
                    <Route path="/" element={<Navigate to="/general/users" replace />} />
                    <Route path="/general/users" element={<UsersScreen />} />
                    <Route path="/general/roles" element={<RolesScreen />} />
                    <Route path="/general/unlock" element={<UnlockScreen />} />
                    <Route path="/general/impersonation-log" element={<ImpersonationLogScreen />} />
                    <Route path="/cashflow/categories" element={<CategoriesScreen />} />
                    <Route path="/cashflow/user-transactions" element={<UserTransactionsScreen />} />
                    <Route path="*" element={<Navigate to="/general/users" replace />} />
                </Routes>
            </main>
        </div>
    );
}

export default function App() {
    const [state, setState] = useState('loading'); // loading | ok | denied | error
    const [user, setUser] = useState(null);

    useEffect(() => {
        getMe()
            .then(data => {
                const perms = data.permissions || [];
                if (perms.includes('roles.view') || data.role === 'owner') {
                    setUser(data);
                    setState('ok');
                } else {
                    setState('denied');
                }
            })
            .catch(() => {
                window.location.href = LANDING_URL;
            });
    }, []);

    if (state === 'loading') {
        return <div className="admin-loading">Loading…</div>;
    }
    if (state === 'denied') {
        return (
            <div className="admin-denied">
                <h2>Access denied</h2>
                <p>You don't have permission to view this panel.</p>
                <a href={LANDING_URL}>← Back to utility-tools</a>
            </div>
        );
    }

    return (
        <BrowserRouter basename={import.meta.env.PROD ? '/utility-tools/admin' : '/'}>
            <AdminApp user={user} />
        </BrowserRouter>
    );
}
