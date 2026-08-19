/**
 * Progress bar + stage label for the waiting screen.
 *
 * Stages are purely cosmetic: the label shown is the first stage whose
 * threshold the current progress has not yet passed.
 */

const PROGRESS_STAGES = [
  { label: "Fetching article…", threshold: 18 },
  { label: "Processing content…", threshold: 38 },
  { label: "Injecting false information…", threshold: 58 },
  { label: "Building playable page…", threshold: 78 },
  { label: "Finalizing round…", threshold: 92 },
  { label: "Ready!", threshold: 100 },
];

export function ProgressTracker({ progress }) {
  const currentStage = PROGRESS_STAGES.find(s => progress <= s.threshold) || PROGRESS_STAGES[PROGRESS_STAGES.length - 1];
  const isReady = progress >= 100;

  return (
    <div className="waiting-progress">
      <div className="waiting-progress-bar">
        <div
          className="waiting-progress-fill"
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
      <div className="waiting-status">
        <span
          className="waiting-status-dot"
          style={isReady ? { background: "var(--green)", animation: "none" } : {}}
        />
        <span className="waiting-status-label">{currentStage.label}</span>
        <span className="waiting-status-pct">{Math.round(progress)}%</span>
      </div>
    </div>
  );
}
