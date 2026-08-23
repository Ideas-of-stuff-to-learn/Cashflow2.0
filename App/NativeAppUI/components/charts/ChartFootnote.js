import { View, Text, StyleSheet } from 'react-native';

// RN port of App/WebUI/src/components/charts/ChartFootnote.jsx - same
// wording, kept in sync across both platforms. Edit THIS string to
// change the footnote text everywhere it's used - each comma marks
// where a line break should go.
const FOOTNOTE_TEXT =
    "Not connected to your bank," +
    "Uses CSV or EXCEL files as inputs (which can easily be downloaded from your bank)," +
    "Uses AI to categorise almost 80-85% of the transactions in preassigned categories," +
    "But some spending cannot be automatically categorised; needs users to self-categorise. This platform helps the user to easily categorise them manually," +
    "You can see the full spending pattern across months and years," +
    "Can easily be shared with parents and guardians for review and discussion (using login details)," +
    "This is not a budgeting tool, only past spending pattern visualisation tool," +
    "The total income / cash-in is also shown for reference";

export default function ChartFootnote() {
    const lines = FOOTNOTE_TEXT.split(',');

    return (
        <View style={styles.footnote}>
            {lines.map((line, i) => (
                <Text
                    key={i}
                    style={[
                        styles.line,
                        i === 0 && styles.lineBold,
                        i === 3 && styles.lineHighlight,
                    ]}
                >
                    {`➤  ${line.trim()}`}
                </Text>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    footnote: {
        marginTop: 16,
        padding: 12,
        backgroundColor: '#5cb962',
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 8,
    },
    line: {
        fontSize: 14,
        lineHeight: 18,
        color: '#290fd2',
    },
    lineBold: {
        fontWeight: 'bold',
    },
    lineHighlight: {
        fontWeight: 'bold',
        color: '#520912',
    },
});
