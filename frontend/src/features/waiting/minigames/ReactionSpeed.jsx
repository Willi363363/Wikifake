/** Test de temps de reaction. */

import { useState, useEffect, useRef, useCallback } from 'react';

function ReactionSpeed() {
  const [phase, setPhase] = useState("idle");
  const [targetPos, setTargetPos] = useState({ x: 50, y: 50 });
  const [startTime, setStartTime] = useState(0);
  const [reactionTime, setReactionTime] = useState(null);
  const [bestTime, setBestTime] = useState(null);
  const [round, setRound] = useState(0);
  const timerRef = useRef(null);

  const startRound = useCallback(() => {
    setPhase("waiting");
    setReactionTime(null);
    const delay = 1000 + Math.random() * 2500;
    timerRef.current = setTimeout(() => {
      setTargetPos({ x: 15 + Math.random() * 70, y: 15 + Math.random() * 70 });
      setStartTime(performance.now());
      setPhase("target");
    }, delay);
  }, []);

  useEffect(() => {
    startRound();
    return () => clearTimeout(timerRef.current);
  }, [round, startRound]);

  const handleTargetClick = (e) => {
    e.stopPropagation();
    if (phase !== "target") return;
    const time = Math.round(performance.now() - startTime);
    setReactionTime(time);
    setPhase("result");
    if (!bestTime || time < bestTime) setBestTime(time);
    setTimeout(() => setRound(r => r + 1), 1500);
  };

  const handleAreaClick = () => {
    if (phase === "waiting") {
      clearTimeout(timerRef.current);
      setPhase("idle");
      setReactionTime(-1);
      setTimeout(() => setRound(r => r + 1), 1200);
    }
  };

  const timeColor = reactionTime && reactionTime > 0
    ? reactionTime < 250 ? "var(--green)" : reactionTime < 400 ? "var(--accent)" : "var(--bronze)"
    : "var(--danger)";

  return (
    <div>
      <div className={`reaction-area${phase === "waiting" ? " waiting-click" : ""}`} onClick={handleAreaClick}>
        {phase === "idle" && <div className="reaction-hint">Click anywhere to start</div>}
        {phase === "waiting" && <div className="reaction-hint" style={{ color: "var(--bronze)" }}>Wait for the target…</div>}
        {phase === "target" && (
          <div
            className="reaction-target"
            style={{ left: `${targetPos.x}%`, top: `${targetPos.y}%` }}
            onClick={handleTargetClick}
          />
        )}
        {phase === "result" && reactionTime < 0 && <div className="reaction-hint" style={{ color: "var(--danger)" }}>Too early! Wait.</div>}
      </div>
      <div className="reaction-result">
        {reactionTime && reactionTime > 0 && (
          <>
            <div className="reaction-time" style={{ color: timeColor }}>{reactionTime}<small>ms</small></div>
            {bestTime && <div className="reaction-best">Best: {bestTime}ms</div>}
          </>
        )}
      </div>
    </div>
  );
}

// 3. MEMORY FLIP CARDS

export default ReactionSpeed;
