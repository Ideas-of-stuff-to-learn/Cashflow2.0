import { useNavigate } from 'react-router-dom';
import '../styles/LegalPages.css';
import { CONTACT_EMAIL } from '../config/legal';

export default function PrivacyScreen() {
    const navigate = useNavigate();
    return (
        <div className="legal-page">
            <button className="legal-back" onClick={() => navigate(-1)}>← Back</button>
            <h1>Privacy Policy</h1>
            <p className="legal-date">Last updated: September 2026</p>

            <h2>What this app is</h2>
            <p>
                Cashflow 2.0 is a personal finance tool that helps you categorise bank transactions
                and visualise spending. Anyone can create a free account via the sign-up page.
            </p>

            <h2>What data we collect</h2>
            <ul>
                <li><strong>Account credentials</strong> — username and a bcrypt-hashed password. Your plain-text password is never stored.</li>
                <li><strong>Transaction data</strong> — the contents of any CSV or Excel files you upload (date, amount, description). This data is stored in a private database and used solely to provide the categorisation and charting features.</li>
                <li><strong>Usage preferences</strong> — column widths, chart settings, and similar UI state are stored in your browser's local storage and synced to your account to persist across devices.</li>
            </ul>

            <h2>What we do not collect</h2>
            <ul>
                <li>We do not collect names, addresses, phone numbers, or any identity information beyond your chosen username.</li>
                <li>We do not use advertising, analytics platforms, or any third-party tracking.</li>
                <li>We do not sell or share your data with any third parties.</li>
            </ul>

            <h2>How data is stored</h2>
            <p>
                Data is stored in a PostgreSQL database hosted on Supabase. Authentication uses
                short-lived JWTs stored in httpOnly cookies — they are not accessible to JavaScript
                and cannot be stolen via XSS. All connections use TLS.
            </p>

            <h2>Third-party services</h2>
            <p>
                Transaction descriptions are sent to the Google Gemini API for automated
                categorisation when simpler matching methods fail. Only the transaction description
                text is sent — no amounts, dates, or account details.
            </p>

            <h2>Input sanitisation and security</h2>
            <p>All user input is sanitised before being stored or processed:</p>
            <ul>
                <li>Every database query uses parameterised placeholders — SQL injection is not possible.</li>
                <li>Transaction descriptions from uploaded files are stripped of leading formula characters (<code>=</code>, <code>+</code>, <code>-</code>, <code>@</code>) to prevent CSV formula injection if data is later exported to a spreadsheet.</li>
                <li>The frontend is built with React, which escapes all dynamic content by default, protecting against cross-site scripting (XSS).</li>
                <li>Passwords are hashed with bcrypt before storage — plain-text passwords are never written to the database.</li>
                <li>Authentication tokens are stored in httpOnly cookies, inaccessible to JavaScript.</li>
            </ul>

            <h2>Data retention</h2>
            <p>
                Your data is retained for as long as your account exists. You may request deletion
                of your account and all associated data at any time by contacting us.
            </p>

            <h2>Your rights</h2>
            <p>
                You may request a copy of your data, correction of inaccurate data, or deletion of
                your account by contacting <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>

            <h2>Changes to this policy</h2>
            <p>
                This policy may be updated from time to time. The date at the top of this page
                reflects the most recent revision.
            </p>
        </div>
    );
}
