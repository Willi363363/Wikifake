/** Modale de fin de partie. */

import { useState, useEffect } from 'react';
import LabelMono from '@/ui/LabelMono';
import AnimatedRanking from './AnimatedRanking';
import { accuracyScore } from '@/lib/breakdown';

function Debrief({ stats, onRestart, allPlayers, onExit }) {
  const [revealStats, setRevealStats] = useState(false);

  // After the ranking finishes (~5.1s), reveal personal stats
  useEffect(() => {
    const id = setTimeout(() => setRevealStats(true), 5400);
    return () => clearTimeout(id);
  }, []);

  const quality = accuracyScore(
    {
      hits: stats.hits,
      false_positives: stats.falsePositives,
    },
    stats.totalFakes,
  );
  const grade = quality >= 0.95 ? { label: "Outstanding", note: "Expert detective", color: "var(--green)", bg: "var(--green-soft)" }
    : quality >= 0.75 ? { label: "Strong", note: "Field agent", color: "var(--accent)", bg: "var(--accent-soft)" }
      : quality >= 0.50 ? { label: "Promising", note: "Trainee", color: "var(--bronze)", bg: "var(--bronze-soft)" }
        : { label: "Compromised", note: "Recalibrate", color: "var(--danger)", bg: "var(--danger-soft)" };

  // Get player's final rank
  // Les scores viennent du serveur : aucun recalcul cote client.
  const roster = allPlayers || [];
  const finalRank = Math.max(1, roster.findIndex((p) => p.you) + 1);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(246, 244, 239, 0.78)",
      backdropFilter: "blur(18px) saturate(180%)",
      WebkitBackdropFilter: "blur(18px) saturate(180%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, overflowY: "auto",
      animation: "fade-in 240ms ease-out",
    }}>
      <div style={{
        width: "min(760px, 100%)",
        background: "white",
        border: "1px solid var(--line)",
        borderRadius: 22,
        boxShadow: "0 30px 80px -20px rgba(24,24,27,0.22), 0 10px 30px -10px rgba(24,24,27,0.10)",
        overflow: "hidden",
        margin: "auto",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 28px",
          borderBottom: "1px solid var(--line)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 8,
              background: "linear-gradient(135deg, var(--accent), #2a7568)",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
            }}>
              <img src="/image.png" style={{
                width: "100%", height: "100%",
                objectFit: "cover",
                borderRadius: 8,
              }} alt="Wikifake logo" />
            </div>
            <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: "var(--ink)", whiteSpace: "nowrap" }}>Mission debrief</span>
          </div>
          <LabelMono>{stats.sessionId} · {new Date().toISOString().slice(0, 10)}</LabelMono>
        </div>

        {/* ANIMATED LIVE RANKING */}
        <div style={{ padding: "24px 0 8px" }}>
          {allPlayers && allPlayers.length > 0 && (
            <AnimatedRanking players={allPlayers} />
          )}
        </div>

        {/* Personal grade reveal */}
        <div style={{
          padding: "20px 32px 12px",
          borderTop: "1px solid var(--line)",
          opacity: revealStats ? 1 : 0,
          transform: revealStats ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 480ms ease, transform 480ms cubic-bezier(.2,.6,.2,1)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div>
              <LabelMono>Your performance</LabelMono>
              <div style={{ display: "flex", flexDirection: "column", marginTop: 6 }}>
                <span style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontSize: 32, fontWeight: 400, fontStyle: "italic",
                  color: grade.color, lineHeight: 1, letterSpacing: "-0.01em",
                  whiteSpace: "nowrap",
                }}>{grade.label}</span>
                <LabelMono style={{ color: grade.color, fontSize: 10, marginTop: 6 }}>{grade.note}</LabelMono>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ textAlign: "right" }}>
                <LabelMono>Final rank</LabelMono>
                <div style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontSize: 28, color: "var(--ink)", fontStyle: "italic",
                  lineHeight: 1, marginTop: 2,
                  fontVariantNumeric: "tabular-nums",
                }}>{finalRank}<span style={{ fontSize: 14, color: "var(--muted)" }}> / {allPlayers?.length || 1}</span></div>
              </div>
              <div style={{ width: 1, height: 36, background: "var(--line)" }} />
              <div style={{ textAlign: "right" }}>
                <LabelMono>Final score</LabelMono>
                <div style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontSize: 36, color: "var(--ink)",
                  lineHeight: 1, marginTop: 2,
                  letterSpacing: "-0.02em",
                  fontVariantNumeric: "tabular-nums",
                }}>{stats.total.toLocaleString()}<span style={{ fontSize: 14, color: "var(--muted)", marginLeft: 4 }}>pts</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Personal breakdown */}
        <div style={{
          padding: "16px 32px 22px",
          opacity: revealStats ? 1 : 0,
          transform: revealStats ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 480ms ease 120ms, transform 480ms cubic-bezier(.2,.6,.2,1) 120ms",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            {[
              { label: "Trouvées", value: `${stats.hits}/${stats.totalFakes}`, color: "var(--green)" },
              { label: "Fausses alertes", value: stats.falsePositives, color: stats.falsePositives === 0 ? "var(--green)" : "var(--danger)" },
              { label: "Indices", value: stats.hintPenalty > 0 ? `−${stats.hintPenalty}` : "0", color: "var(--bronze)" },
              { label: "Bonus temps", value: `+${stats.timeBonus}`, color: "var(--green)" },
            ].map((m, i) => (
              <div key={i} style={{
                padding: "10px 12px",
                background: "rgba(255,255,255,0.4)",
                border: "1px solid var(--line)",
                borderRadius: 10,
              }}>
                <LabelMono>{m.label}</LabelMono>
                <div className="mono" style={{
                  fontSize: 16, fontWeight: 600, color: m.color, marginTop: 4,
                  fontVariantNumeric: "tabular-nums",
                }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: "0 32px 28px",
          display: "flex", gap: 10, justifyContent: "flex-end",
          opacity: revealStats ? 1 : 0,
          transition: "opacity 360ms ease 280ms",
        }}>
          <button className="btn ghost" onClick={() => onRestart("review")}>Review article</button>
          {onExit && (
            <button className="btn ghost" onClick={onExit} style={{ color: "var(--danger)" }}>
              Quitter la salle
            </button>
          )}
          <button className="btn primary" onClick={() => onRestart("new")}>
            New mission
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M3 6.5h7M6.5 3l3.5 3.5L6.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ Brief Modal ============ */

export default Debrief;
