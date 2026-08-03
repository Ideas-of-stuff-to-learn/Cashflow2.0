import '../../styles/rangeWindowSlider.css';

export default function RangeWindowSlider({
    trackMax, currentIndex, onChangeIndex, startLabel, endLabel,
}) {
    if (trackMax <= 0) return null;

    const leftValue = currentIndex;
    const rightValue = Math.min(currentIndex + 11, trackMax);

    // Percentages along the track, used to position the visible
    // "fill" bar between the two handles - this is what gives the
    // normal slider look of a colored selected range.
    const leftPercent = (leftValue / trackMax) * 100;
    const rightPercent = (rightValue / trackMax) * 100;

    return (
        <div className="range-window-slider">
            <div className="range-window-slider-labels">
                <span className="range-window-slider-label">{startLabel}</span>
                <span className="range-window-slider-label">{endLabel}</span>
            </div>
            <div className="range-window-slider-track">
                {/* The one real, visible background line - both inputs'
                    own tracks are made fully invisible in CSS, so this
                    is the only track line actually shown. */}
                <div className="range-window-slider-line" />

                {/* The colored "selected range" bar between the two
                    handles - positioned purely with left/right
                    percentages computed above. */}
                <div
                    className="range-window-slider-fill"
                    style={{ left: `${leftPercent}%`, right: `${100 - rightPercent}%` }}
                />

                <input
                    type="range"
                    className="range-window-slider-input"
                    min={0}
                    max={trackMax}
                    value={leftValue}
                    onChange={e => onChangeIndex(parseInt(e.target.value, 10))}
                />
                <input
                    type="range"
                    className="range-window-slider-input"
                    min={0}
                    max={trackMax}
                    value={rightValue}
                    onChange={e => onChangeIndex(parseInt(e.target.value, 10) - 11)}
                />
            </div>
        </div>
    );
}