export default function ChartBackgroundCatcher({ totalWidth, contentHeight, onClick }) {
    return (
        <div
            className="chart-background-catcher"
            style={{ position: 'absolute', top: 0, left: 0, width: totalWidth, height: contentHeight }}
            onClick={onClick}
        />
    );
}