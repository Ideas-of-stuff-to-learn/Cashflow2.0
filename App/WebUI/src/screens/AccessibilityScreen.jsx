import { Link } from 'react-router-dom';
import '../styles/LegalPages.css';

export default function AccessibilityScreen() {
    return (
        <div className="legal-page">
            <Link to="/login" className="legal-back">← Back</Link>
            <h1>Accessibility Statement</h1>
            <p className="legal-date">Last updated: September 2026</p>

            <h2>Our commitment</h2>
            <p>
                We aim to make Cashflow 2.0 usable by as many people as possible. This includes
                users who rely on keyboard navigation, screen readers, or other assistive
                technologies.
            </p>

            <h2>Current status</h2>
            <p>
                Cashflow 2.0 is a private tool under active development. We have taken the
                following steps to improve accessibility:
            </p>
            <ul>
                <li>Semantic HTML elements are used throughout (headings, lists, buttons, labels).</li>
                <li>Interactive controls have descriptive labels and are keyboard-focusable.</li>
                <li>Colour contrast ratios meet WCAG 2.1 AA standards for text.</li>
                <li>The app is responsive and usable at a range of viewport sizes.</li>
                <li>Focus indicators are visible on interactive elements.</li>
            </ul>

            <h2>Known limitations</h2>
            <p>
                Some areas of the app are still being improved:
            </p>
            <ul>
                <li>The virtualised transaction table may not announce row count changes to screen readers.</li>
                <li>Some chart visualisations do not yet have text alternatives.</li>
                <li>Drag-to-resize column handles may not be fully accessible via keyboard alone.</li>
            </ul>

            <h2>Feedback</h2>
            <p>
                If you encounter an accessibility barrier or have a suggestion, please contact
                us at <a href="mailto:khaitanarmaan@gmail.com">khaitanarmaan@gmail.com</a>. We
                will do our best to address issues promptly.
            </p>

            <h2>Technical approach</h2>
            <p>
                The web app is built with React and targets modern browsers. We test primarily
                on Chrome on Windows and macOS. Mobile access is via a separate React Native app
                (iOS and Android).
            </p>
        </div>
    );
}
