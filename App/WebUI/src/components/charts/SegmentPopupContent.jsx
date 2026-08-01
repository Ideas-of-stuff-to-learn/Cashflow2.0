// components/charts/SegmentPopupContent.jsx
import { MONTH_LABELS_FULL } from '../../utils/charts/monthWindow';

export default function SegmentPopupContent({ segment }) {
    if (!segment) return null;

    const periodLabel = segment.month
        ? `${MONTH_LABELS_FULL[segment.month - 1]} ${segment.year}`
        : `${segment.year}`;

    return (
        <div className="segment-popup-content">
            <p className="segment-popup-period">{periodLabel}</p>
            <p className="segment-popup-category">{segment.category}</p>
            <p className="segment-popup-value">
                £{segment.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
        </div>
    );
}