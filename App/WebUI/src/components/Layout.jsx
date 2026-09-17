// components/Layout.jsx
import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import RoleBadge from './RoleBadge';
import ChartFootnote from './charts/ChartFootnote';
import { useIsMobile } from '../customHooks/useIsMobile';
import '../styles/Layout.css';

function FootnoteModal({ onClose }) {
    return (
        <div className="info-modal-overlay" onClick={onClose}>
            <div className="info-modal info-modal-footnote" onClick={e => e.stopPropagation()}>
                <button className="info-modal-close" onClick={onClose}>✕</button>
                <h2 className="info-modal-title" style={{ marginBottom: 16 }}>About this tool</h2>
                <ChartFootnote />
            </div>
        </div>
    );
}

function TransactionsInfoModal({ onClose }) {
    return (
        <div className="info-modal-overlay" onClick={onClose}>
            <div className="info-modal" onClick={e => e.stopPropagation()}>
                <button className="info-modal-close" onClick={onClose}>✕</button>
                <h2 className="info-modal-title">About this page</h2>
                <p className="info-modal-lead">
                    This is your transaction history — the raw data behind your spending charts.
                    Use it to review, search, and correct how transactions are categorised so your charts stay accurate.
                </p>
                <ul className="info-modal-list">
                    <li><strong>Search by name</strong> — type in the search bar to filter transactions by description in real time.</li>
                    <li><strong>Change a single category</strong> — tap any transaction row to open a category picker for just that transaction.</li>
                    <li><strong>Bulk change categories</strong> — tap <em>Select</em>, pick multiple transactions, then tap <em>Change category</em> to reassign them all at once.</li>
                    <li><strong>Resize columns</strong> — drag the edge of any column header to adjust its width. Your layout is saved automatically.</li>
                    <li><strong>Sort</strong> — tap Date, Amount, or Category headers to sort the list.</li>
                </ul>
            </div>
        </div>
    );
}

export default function Layout() {
    const location = useLocation();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const isContents = location.pathname === '/contents';
    const isCharts = location.pathname === '/charts';
    const isDashboard = location.pathname === '/dashboard';
    const [showInfo, setShowInfo] = useState(false);
    const [showFootnote, setShowFootnote] = useState(false);

    return (
        <div className={`app-shell${(isDashboard || isContents) ? ' app-shell-locked' : ''}`}>
            <header className="app-header">
                {/* col 1: back button / title / spacer */}
                {isDashboard
                    ? <h1 className="title app-header-title">Spending Pattern Visualisation Tool</h1>
                    : isContents
                        ? <button className="app-header-back-btn" onClick={() => navigate(isMobile ? '/home' : '/dashboard')}>
                            {isMobile ? '← Home' : '← Dashboard'}
                          </button>
                        : (isCharts && isMobile)
                            ? <button className="app-header-back-btn" onClick={() => navigate('/home')}>
                                ← Home
                              </button>
                            : <div />
                }
                {/* col 2: center title (always present so col 3 stays right) */}
                {isContents
                    ? <span className="app-header-page-title">
                        Transactions
                        <button className="info-icon-btn" onClick={() => setShowInfo(true)} title="About this page">ℹ</button>
                      </span>
                    : (isDashboard || isCharts)
                        ? <span className="header-pill-group">
                            <button className="info-btn-footnote" onClick={() => setShowFootnote(true)} title="About this tool">User Information</button>
                            <button className="info-btn-footnote info-btn-security" onClick={() => navigate('/data-security')} title="Data security">🔒 Data Security</button>
                          </span>
                        : <div />
                }
                {/* col 3: always right */}
                <RoleBadge />
            </header>
            <div className="app-content">
                <Outlet />
            </div>
            <footer className="app-footer">
                <Link to="/privacy">Privacy</Link>
                <Link to="/terms">Terms</Link>
                <Link to="/accessibility">Accessibility</Link>
                <Link to="/cookies">Cookies</Link>
            </footer>
            {showInfo && <TransactionsInfoModal onClose={() => setShowInfo(false)} />}
            {showFootnote && <FootnoteModal onClose={() => setShowFootnote(false)} />}
        </div>
    );
}