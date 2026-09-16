import { Link } from 'react-router-dom';
import '../styles/LegalPages.css';
import { CONTACT_EMAIL } from '../config/legal';

export default function TermsScreen() {
    return (
        <div className="legal-page">
            <Link to="/login" className="legal-back">← Back</Link>
            <h1>Terms of Use</h1>
            <p className="legal-date">Last updated: September 2026</p>

            <h2>Access</h2>
            <p>
                Cashflow 2.0 is a free, publicly available tool. Anyone may create an account
                via the sign-up page. By creating an account and using the app you agree to
                these terms.
            </p>

            <h2>Acceptable use</h2>
            <p>You agree to use this app only for its intended purpose: tracking and categorising your own personal financial transactions. You must not:</p>
            <ul>
                <li>Attempt to access other users' data or accounts.</li>
                <li>Upload malicious files or attempt to exploit the application.</li>
                <li>Use the app for any unlawful purpose.</li>
                <li>Share your credentials with others.</li>
            </ul>

            <h2>Your data</h2>
            <p>
                You retain ownership of all financial data you upload. By uploading data you grant
                the app permission to process and store it for the purpose of providing the service.
                See the <Link to="/privacy">Privacy Policy</Link> for details on how data is handled.
            </p>

            <h2>No warranties</h2>
            <p>
                This app is provided as-is, without warranty of any kind. Categorisation results
                are automated and may be incorrect. You are responsible for verifying the accuracy
                of any data before relying on it for financial decisions.
            </p>

            <h2>Limitation of liability</h2>
            <p>
                To the fullest extent permitted by law, we are not liable for any loss or damage
                arising from use of this application, including any errors in transaction
                categorisation or data loss.
            </p>

            <h2>Termination</h2>
            <p>
                You may delete your account at any time by contacting us. We reserve the right
                to suspend or terminate accounts that violate these terms.
            </p>

            <h2>Changes to these terms</h2>
            <p>
                These terms may be updated from time to time. Continued use of the app after
                changes are posted constitutes acceptance of the revised terms.
            </p>

            <h2>Contact</h2>
            <p>
                Questions about these terms: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
        </div>
    );
}
