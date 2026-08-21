/** Podium anime du debrief. */

import { useEffect, useRef, useState } from 'react';

import { scoreAtStage, stageDelta } from '@/lib/breakdown';
import LabelMono from '@/ui/LabelMono';

const STAGE_LABELS = [
  { label: "Comptage des detections", note: "Points de base par anomalie trouvee" },
  { label: "Application des penalites", note: "Retrait des fausses alertes" },
  { label: "Indices et pillages", note: "Cout des indices et points voles" },
  { label: "Bonus de temps", note: "Recompense pour la rapidite" },
  { label: "Score final", note: "Classement definitif" },
];

function AnimatedRanking({ players }) {
  const [stage, setStage] = useState(0);
  const [displayed, setDisplayed] = useState({});
  const [stageProgress, setStageProgress] = useState(0);

  // Sequence stage transitions
  useEffect(() => {
    const schedule = [800, 1300, 1100, 1000, 900]; // start delay + per-stage
    const timers = [];
    let total = 0;
    schedule.forEach((delay, i) => {
      total += delay;
      timers.push(setTimeout(() => setStage(i + 1), total));
    });
    return () => timers.forEach(clearTimeout);
  }, [players.length]);

  // Score at stage

  // Animate displayed scores when stage changes
  const playersRef = useRef(players);
  playersRef.current = players;
  const displayedRef = useRef(displayed);
  displayedRef.current = displayed;

  useEffect(() => {
    const players = playersRef.current;
    const displayed = displayedRef.current;
    const startTime = performance.now();
    const startScores = {};
    const targetScores = {};
    players.forEach(p => {
      startScores[p.id] = displayed[p.id] || 0;
      targetScores[p.id] = scoreAtStage(p.breakdown, stage);
    });

    const dur = stage === 0 ? 0 : 900;
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setStageProgress(eased);
      const next = {};
      players.forEach(p => {
        next[p.id] = Math.round(startScores[p.id] + (targetScores[p.id] - startScores[p.id]) * eased);
      });
      setDisplayed(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage]);

  // Compute current ranks
  const ranked = [...players].sort((a, b) => (displayed[b.id] || 0) - (displayed[a.id] || 0));
  const rankIndex = {};
  ranked.forEach((p, i) => { rankIndex[p.id] = i; });
  const max = Math.max(...players.map(p => displayed[p.id] || 0), 1);

  const ROW_HEIGHT = 60;
  const totalHeight = players.length * ROW_HEIGHT;

  // Per-stage chip for each player (shows delta)

  const phase = STAGE_LABELS[Math.min(stage, STAGE_LABELS.length - 1)];

  return (
    <div style={{ padding: "0 32px 28px" }}>
      {/* Phase header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        padding: "0 0 14px",
        gap: 16,
      }}>
        <div style={{ minWidth: 0 }}>
          <LabelMono>Live ranking</LabelMono>
          <div style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: 22, color: "var(--ink)", lineHeight: 1.1, marginTop: 2,
            transition: "color 280ms",
            whiteSpace: "nowrap",
          }}>
            {phase.label}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "flex-end", marginBottom: 4 }}>
            {STAGE_LABELS.map((_, i) => (
              <span key={i} style={{
                width: i === stage - 1 ? 16 : 6,
                height: 4,
                borderRadius: 2,
                background: i < stage ? "var(--accent)" : "var(--line-strong)",
                transition: "all 320ms cubic-bezier(.2,.6,.2,1)",
              }} />
            ))}
          </div>
          <span style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>{phase.note}</span>
        </div>
      </div>

      {/* Animated rows */}
      <div style={{
        position: "relative",
        height: totalHeight,
      }}>
        {players.map((p) => {
          const currentRank = rankIndex[p.id];
          const yOffset = currentRank * ROW_HEIGHT;
          const score = displayed[p.id] || 0;
          const delta = stageDelta(p.breakdown, stage);
          const isLeader = currentRank === 0 && stage >= 1;
          return (
            <div key={p.id} style={{
              position: "absolute", top: 0, left: 0, right: 0,
              transform: `translateY(${yOffset}px)`,
              transition: "transform 700ms cubic-bezier(.4,.0,.2,1)",
              height: ROW_HEIGHT - 8,
              padding: "10px 14px",
              display: "grid",
              gridTemplateColumns: "26px 28px 1fr auto auto",
              gap: 14, alignItems: "center",
              background: p.you ? "rgba(31, 87, 77, 0.045)" : "rgba(255, 255, 255, 0.5)",
              border: `1px solid ${isLeader ? "rgba(140, 109, 54, 0.32)" : p.you ? "var(--accent-line)" : "var(--line)"}`,
              borderRadius: 12,
              boxShadow: isLeader ? "0 6px 14px -6px rgba(140, 109, 54, 0.25)" : "none",
            }}>
              {/* Rank */}
              <span style={{
                fontFamily: "'Instrument Serif', serif",
                fontSize: 22, fontStyle: "italic",
                color: isLeader ? "var(--bronze)" : currentRank === 1 ? "var(--muted)" : "var(--muted-2)",
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                textAlign: "center",
                transition: "color 320ms",
              }}>{currentRank + 1}</span>

              {/* Avatar */}
              <span style={{
                width: 26, height: 26, borderRadius: "50%",
                background: p.color, color: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 700,
                border: p.you ? "2px solid var(--ink)" : "none",
                flexShrink: 0,
              }}>{p.name[0]}</span>

              {/* Name + bar */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <span style={{
                  fontSize: 13, fontWeight: p.you ? 600 : 500,
                  color: "var(--ink)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {p.name}
                  {p.you && <span style={{ color: "var(--muted)", marginLeft: 6, fontSize: 11 }}>· you</span>}
                  {isLeader && <span style={{ color: "var(--bronze)", marginLeft: 8, fontSize: 11, fontStyle: "italic", fontFamily: "'Instrument Serif', serif" }}>Leader</span>}
                </span>
                <div style={{ position: "relative", height: 3, background: "rgba(24,24,27,0.06)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${(score / max) * 100}%`,
                    background: p.you ? "var(--accent)" : p.color,
                    borderRadius: 999,
                    transition: "width 600ms cubic-bezier(.2,.6,.2,1), background 200ms",
                    boxShadow: isLeader ? `0 0 8px ${p.color}55` : "none",
                  }} />
                </div>
              </div>

              {/* Delta chip for current stage */}
              <span style={{
                opacity: delta && stageProgress < 1 ? (1 - stageProgress * 0.4) : 0,
                transform: delta ? `translateY(${(1 - stageProgress) * 4}px)` : "none",
                transition: "opacity 200ms ease, transform 320ms ease",
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11, fontWeight: 600,
                color: delta?.color || "var(--muted)",
                fontVariantNumeric: "tabular-nums",
                minWidth: 40,
                textAlign: "right",
              }}>
                {delta?.value || ""}
              </span>

              {/* Score */}
              <span style={{
                fontFamily: "'Instrument Serif', serif",
                fontSize: 24, fontWeight: 400,
                color: "var(--ink)",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.01em",
                minWidth: 64,
                textAlign: "right",
                lineHeight: 1,
              }}>{score.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============ Debrief / results modal ============ */

export default AnimatedRanking;
