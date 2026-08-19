/**
 * FloatingLeaderboard — sticky bottom-left ranking pill that expands on hover.
 *
 * Collapsed it shows only the leader's avatar and score; hovering widens the
 * card and staggers the full list in. Ported verbatim from the legacy hud.jsx.
 */
import { useState } from 'react';
import { LabelMono, PulseDot, HairProgress } from '../../components/ui';

export function FloatingLeaderboard({ players }) {
  const [hovered, setHovered] = useState(false);
  const max = Math.max(...players.map(p => p.score), 1);
  const top = players[0];
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "fixed",
        left: 24,
        bottom: 24,
        zIndex: 65,
        width: hovered ? 280 : 200,
        background: hovered ? "rgba(255, 255, 255, 0.86)" : "rgba(255, 255, 255, 0.74)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        boxShadow: hovered
          ? "0 24px 60px -16px rgba(24, 24, 27, 0.28), 0 8px 16px -6px rgba(24, 24, 27, 0.10)"
          : "0 12px 30px -16px rgba(24, 24, 27, 0.18), 0 4px 10px -6px rgba(24, 24, 27, 0.06)",
        overflow: "hidden",
        transition: "width 320ms cubic-bezier(.2,.6,.2,1), background 200ms, box-shadow 240ms",
        cursor: "default",
      }}
    >
      {/* Header strip — always visible */}
      <div style={{
        padding: "11px 14px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        gap: 10,
        borderBottom: hovered ? "1px solid var(--line)" : "1px solid transparent",
        transition: "border-color 200ms",
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <PulseDot color="var(--accent)" size={5} />
          <LabelMono>Ranking · {players.length}</LabelMono>
        </span>
        {!hovered && top && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{
              width: 18, height: 18, borderRadius: "50%",
              background: top.color, color: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 700,
              border: top.you ? "2px solid var(--ink)" : "none",
            }}>{top.name[0]}</span>
            <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
              {top.score}
            </span>
          </span>
        )}
        {hovered && (
          <span className="mono" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.14em" }}>LIVE</span>
        )}
      </div>

      {/* Expanded list */}
      <div style={{
        maxHeight: hovered ? 320 : 0,
        opacity: hovered ? 1 : 0,
        transition: "max-height 320ms cubic-bezier(.2,.6,.2,1), opacity 180ms ease",
        overflow: "hidden",
      }}>
        <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          {players.map((p, i) => (
            <div key={p.id} style={{
              display: "grid", gridTemplateColumns: "16px 22px 1fr auto", gap: 10, alignItems: "center",
              opacity: hovered ? 1 : 0,
              transform: hovered ? "translateY(0)" : "translateY(-6px)",
              transition: `opacity 280ms ease ${i * 30}ms, transform 280ms cubic-bezier(.2,.6,.2,1) ${i * 30}ms`,
            }}>
              <span className="mono" style={{ fontSize: 11, color: i === 0 ? "var(--bronze)" : "var(--muted)", fontWeight: 600 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{
                width: 20, height: 20, borderRadius: "50%",
                background: p.color, color: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Geist Mono', monospace", fontSize: 10, fontWeight: 700,
                border: p.you ? "2px solid var(--ink)" : "none",
              }}>
                {p.name[0]}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <span style={{
                  fontSize: 12, fontWeight: p.you ? 600 : 500,
                  color: "var(--ink)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{p.name}{p.you && <span style={{ color: "var(--muted)", marginLeft: 4, fontSize: 10 }}>· you</span>}</span>
                <HairProgress value={(p.score / max) * 100} color={p.you ? "var(--accent)" : p.color} height={2} />
              </div>
              <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                {p.score}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
