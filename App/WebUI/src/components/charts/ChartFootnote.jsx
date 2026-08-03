import '../../styles/chartFootnote.css';

// Edit THIS string to change the footnote text everywhere it's used -
// each comma marks where a line break should go. Using a plain string
// with a simple split/map means changing the wording is just editing
// text, not JSX structure.
const FOOTNOTE_TEXT =
    "Not connected to your bank," +
    "Uses CSV or EXCEL files as inputs (which can easily be downloaded from your bank)," +
    "Uses AI to categorise almost 80-85% of the transactions in preassigned categories,"+
    "But some spending cannot be automatically categorised; needs users to self-categorise. This platform helps the user to easily categorise them manually,"+
    "You can see the full spending pattern across months and years,"+
    "Can easily be shared with parents and guardians for review and discussion (using login details),"+
    "This is not a budgeting tool, only past spending pattern visualisation tool,"+
    "The total income / cash-in is also shown for reference";

export default function ChartFootnote() {
    const lines = FOOTNOTE_TEXT.split(',');

    return (
        <div className="chart-footnote">
            {lines.map((line, i) => (
                <p key={i}>{line.trim()}</p>
            ))}
        </div>
    );
}