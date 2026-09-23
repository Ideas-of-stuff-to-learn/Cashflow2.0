import './LoadingBarsPlaceholder.css';

// The ONE place "we have nothing real to show yet, but something is
// happening" is visually represented anywhere in the app. Purely
// decorative - a handful of bars with staggered, continuous up/down
// animation, no real values behind any of it. Swapped in wherever a
// chart would otherwise show fake/dummy data or a blank space while
// waiting for genuine data to exist.
export default function LoadingBarsPlaceholder({ message = 'Preparing your data...' }) {
    return (
        <div className="loading-bars-container">
            <div className="loading-bars">
                {[0, 1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="loading-bar" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
            </div>
            <p className="loading-bars-message">{message}</p>
        </div>
    );
}