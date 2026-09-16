import { Link } from 'react-router-dom';
import '../styles/LegalPages.css';

export default function TermsScreen() {
    return (
        <div className="legal-page">
            <Link to="/login" className="legal-back">← Back</Link>
            <h1>Terms of Use</h1>
            <p className="legal-date">Last updated: September 2026</p>

            <h2>Access</h2>
            <p>
                Cashflow 2.0 is a private tool. Access is granted solely at the discretion of the
                app owner. There is no public registration. Using this app means you have been
                explicitly invited to do so.
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
                The app owner is not liable for any loss or damage arising from use of this
                application, including any errors in transaction categorisation or data loss.
            </p>

            <h2>Termination</h2>
            <p>
                Access may be revoked at any time at the owner's discretion. On termination, your
                data may be deleted.
            </p>

            <h2>Changes to these terms</h2>
            <p>
                These terms may be updated from time to time. Continued use of the app after
                changes are posted constitutes acceptance of the revised terms.
            </p>

            <h2>Contact</h2>
            <p>
                Questions about these terms: <a href="mailto:khaitanarmaan@gmail.com">khaitanarmaan@gmail.com</a>
            </p>
        </div>
    );
}
