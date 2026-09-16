import { Link } from 'react-router-dom';
import '../styles/LegalPages.css';
import { CONTACT_EMAIL } from '../config/legal';

export default function CookiesScreen() {
    return (
        <div className="legal-page">
            <Link to="/login" className="legal-back">← Back</Link>
            <h1>Cookie Policy</h1>
            <p className="legal-date">Last updated: September 2026</p>

            <h2>What are cookies</h2>
            <p>
                Cookies are small text files stored in your browser. They allow web apps to
                remember state between requests and across sessions.
            </p>

            <h2>Cookies we use</h2>
            <p>Cashflow 2.0 uses only functional cookies required for authentication. We do not use advertising, tracking, or analytics cookies.</p>

            <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '14px', fontSize: '14px' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ textAlign: 'left', padding: '8px 12px 8px 0', fontWeight: 600 }}>Name</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px 8px 0', fontWeight: 600 }}>Purpose</th>
                        <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 600 }}>Duration</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 12px 8px 0', fontFamily: 'monospace' }}>access_token_cookie</td>
                        <td style={{ padding: '8px 12px 8px 0' }}>JWT access token — authenticates API requests</td>
                        <td style={{ padding: '8px 0' }}>24 hours</td>
                    </tr>
                    <tr>
                        <td style={{ padding: '8px 12px 8px 0', fontFamily: 'monospace' }}>refresh_token_cookie</td>
                        <td style={{ padding: '8px 12px 8px 0' }}>JWT refresh token — renews the access token without requiring a new login</td>
                        <td style={{ padding: '8px 0' }}>30 days</td>
                    </tr>
                </tbody>
            </table>

            <h2>HttpOnly and security</h2>
            <p>
                Both cookies are set as <strong>httpOnly</strong>, meaning they cannot be read
                by JavaScript in the browser. This protects them from cross-site scripting (XSS)
                attacks. They are also sent only over HTTPS connections.
            </p>

            <h2>Local storage</h2>
            <p>
                In addition to cookies, the app uses browser local storage to save UI preferences
                such as column widths and chart settings. This data never leaves your browser
                except to be synced to your own account on our server — it is not shared with
                any third party.
            </p>

            <h2>No third-party cookies</h2>
            <p>
                We do not use Google Analytics, Meta Pixel, or any other third-party tracking.
                No cookies are placed by external services.
            </p>

            <h2>Managing cookies</h2>
            <p>
                You can clear cookies at any time through your browser settings. Clearing the
                authentication cookies will log you out. Clearing local storage will reset your
                UI preferences.
            </p>

            <h2>Contact</h2>
            <p>
                Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
        </div>
    );
}
