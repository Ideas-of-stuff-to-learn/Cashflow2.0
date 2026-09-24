import { useState } from 'react';
import { getUsers, getUserTransactions } from '../../api.js';

const PAGE_SIZE = 50;

export default function UserTransactionsScreen() {
    const [users, setUsers] = useState(null);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [loadingTxns, setLoadingTxns] = useState(false);
    const [error, setError] = useState('');

    async function loadUsers() {
        if (users !== null) return;
        setLoadingUsers(true);
        try {
            setUsers(await getUsers());
        } catch (e) {
            setError(e.message);
        } finally {
            setLoadingUsers(false);
        }
    }

    async function selectUser(user) {
        setSelectedUser(user);
        setPage(0);
        await fetchTransactions(user.id, 0);
    }

    async function fetchTransactions(userId, pageNum) {
        setLoadingTxns(true); setError('');
        try {
            const data = await getUserTransactions(userId, pageNum * PAGE_SIZE, PAGE_SIZE);
            setTransactions(data.transactions);
            setTotal(data.total);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoadingTxns(false);
        }
    }

    async function goToPage(p) {
        setPage(p);
        await fetchTransactions(selectedUser.id, p);
    }

    const filteredUsers = (users || []).filter(u =>
        u.username.toLowerCase().includes(search.toLowerCase())
    );
    const totalPages = Math.ceil(total / PAGE_SIZE);

    return (
        <div>
            <h1 className="screen-title">User Transactions</h1>
            {error && <div className="screen-error">{error}</div>}

            {!selectedUser ? (
                <div>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: 13 }}>Select a user to view their transactions.</p>
                    <div className="admin-search-row">
                        <input
                            className="admin-input"
                            placeholder="Search by username…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onFocus={loadUsers}
                        />
                    </div>
                    {loadingUsers && <p style={{ color: 'var(--text-muted)' }}>Loading users…</p>}
                    {users !== null && (
                        <div className="admin-table-wrap">
                            <table>
                                <thead>
                                    <tr><th>ID</th><th>Username</th><th>Role</th><th></th></tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map(u => (
                                        <tr key={u.id}>
                                            <td style={{ color: 'var(--text-muted)' }}>{u.id}</td>
                                            <td>{u.username}</td>
                                            <td>{u.role}</td>
                                            <td>
                                                <button className="btn btn-primary btn-sm" onClick={() => selectUser(u)}>View</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setSelectedUser(null)}>← Back</button>
                        <span style={{ fontWeight: 600 }}>{selectedUser.username}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{total} transaction{total !== 1 ? 's' : ''}</span>
                    </div>
                    {loadingTxns ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : (
                        <>
                            <div className="admin-table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Date</th>
                                            <th>Description</th>
                                            <th>Amount</th>
                                            <th>Category</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactions.map(t => (
                                            <tr key={t.id}>
                                                <td style={{ color: 'var(--text-muted)' }}>{t.id}</td>
                                                <td style={{ whiteSpace: 'nowrap' }}>{t.txn_date}</td>
                                                <td>{t.description}</td>
                                                <td style={{ fontFamily: 'monospace', textAlign: 'right' }}>
                                                    <span style={{ color: t.amount < 0 ? 'var(--danger)' : 'var(--success)' }}>
                                                        {t.amount.toFixed(2)}
                                                    </span>
                                                </td>
                                                <td style={{ color: 'var(--text-muted)' }}>{t.category || '—'}</td>
                                            </tr>
                                        ))}
                                        {transactions.length === 0 && (
                                            <tr><td colSpan={5} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No transactions</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {totalPages > 1 && (
                                <div className="admin-pagination">
                                    <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => goToPage(page - 1)}>← Prev</button>
                                    <span>Page {page + 1} of {totalPages}</span>
                                    <button className="btn btn-ghost btn-sm" disabled={page >= totalPages - 1} onClick={() => goToPage(page + 1)}>Next →</button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
