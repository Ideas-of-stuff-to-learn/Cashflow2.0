import '../../styles/rangeWindowSlider.css';

// A single native range input represents the WINDOW'S START position -
// not two independent handles. Dragging it calls setPositionByIndex
// (either setMonthWindowByIndex or setYearWindowByIndex from
// useChartWindows), which keeps the 12-wide window fixed and just
// moves where it starts. The two "handles" the person sees are really
// just visual labels showing the resulting window's first/last item,
// not independently draggable - this matches the "auto-adjusts the
// other side to maintain 12" behavior exactly, since there IS only one
// real value being dragged.
export default function RangeWindowSlider({
    maxIndex, currentIndex, onChangeIndex, startLabel, endLabel,
}) {
    if (maxIndex <= 0) return null;

    return (
        <div className="range-window-slider">
            <div className="range-window-slider-labels">
                <span className="range-window-slider-label">{startLabel}</span>
                <span className="range-window-slider-label">{endLabel}</span>
            </div>
            <input
                type="range"
                className="range-window-slider-input"
                min={0}
                max={maxIndex}
                value={currentIndex}
                onChange={e => onChangeIndex(parseInt(e.target.value, 10))}
            />
        </div>
    );
}