import { useState } from 'react';
import './ProgressBar.css';

// The single visible progress indicator during categorisation.
// Collapsed: bar + percentage. Expanded: phase, batch count, raw
// status text, and the most recent timing info the backend returned -
// round trip time always, plus curated Gemini highlights for LLM
// batches specifically (see pickLlmTimingHighlights in llmTierRunner.js).
export default function ProgressBar({ progress, status }) {
    const [expanded, setExpanded] = useState(false);

    if (!progress || progress.total === 0) return null;

    const percent = Math.round((progress.current / progress.total) * 100);
    const timing = progress.lastTiming;

    return (
        <div className="progress-bar-container">
            <button className="progress-bar-header" onClick={() => setExpanded(e => !e)}>
                <div className="progress-bar-track">
                    <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
                </div>
                <span className="progress-bar-percent">{percent}%</span>
                <span className="progress-bar-toggle">{expanded ? '▲' : '▼'}</span>
            </button>

            {expanded && (
                <div className="progress-bar-details">
                    <p className="progress-bar-phase">{progress.phase}</p>
                    <p className="progress-bar-batch">Batch {progress.current} of {progress.total}</p>
                    {status && <p className="progress-bar-status">{status}</p>}

                    {timing && (
                        <div className="progress-bar-timing">
                            <p className="progress-bar-timing-line">
                                {timing.phase} round trip: {(timing.httpElapsedMs / 1000).toFixed(2)}s
                            </p>
                            {timing.highlights && (
                                <>
                                    {timing.highlights.gemini_ms != null && (
                                        <p className="progress-bar-timing-line">
                                            Gemini time: {(timing.highlights.gemini_ms / 1000).toFixed(2)}s
                                        </p>
                                    )}
                                    {timing.highlights.gemini_percentage != null && (
                                        <p className="progress-bar-timing-line">
                                            Needed AI: {timing.highlights.gemini_percentage}%
                                        </p>
                                    )}
                                    {timing.highlights.exact_percentage != null && (
                                        <p className="progress-bar-timing-line">
                                            Resolved from cache: {timing.highlights.exact_percentage}%
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}