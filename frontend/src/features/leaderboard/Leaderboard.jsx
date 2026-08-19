/**
 * Leaderboard — in-page live ranking card (sidebar variant).
 *
 * Bars are scaled against the current top score so the leader always fills
 * the row. Ported verbatim from the legacy hud.jsx.
 */
import { LabelMono, PulseDot, HairProgress } from '../../components/ui';

export function Leaderboard({ players }) {
  const max = Math.max(...players.map(p => p.score), 1);
  return (
    <div className="glass" style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <LabelMono>Live ranking</LabelMono>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <PulseDot color="var(--accent)" size={5} />
          <LabelMono style={{ fontSize: 9 }}>{players.length} agents</LabelMono>
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {players.map((p, i) => (
          <div key={p.id} style={{
            display: "grid", gridTemplateColumns: "20px 28px 1fr auto", gap: 10, alignItems: "center",
          }}>
            <span className="mono" style={{ fontSize: 11, color: i === 0 ? "var(--bronze)" : "var(--muted)", fontWeight: 600 }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span style={{
              width: 24, height: 24, borderRadius: "50%",
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
              }}>{p.name}{p.you && <span style={{ color: "var(--muted)", marginLeft: 4 }}>· you</span>}</span>
              <HairProgress value={(p.score / max) * 100} color={p.you ? "var(--accent)" : p.color} height={2} />
            </div>
            <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
              {p.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
