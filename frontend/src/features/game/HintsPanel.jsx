/**
 * HintsPanel — inline (non-modal) Intel card with the same hint/reveal
 * mechanic as IntelOverlay, in a denser layout. Ported from hud.jsx.
 */
import { LabelMono, Chip } from '../../components/ui';

export function HintsPanel({ targets, unlocked, onUnlock }) {
  return (
    <div className="glass" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 24, height: 24, borderRadius: 8,
            background: "var(--bronze-soft)", color: "var(--bronze)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1.5v1m4 1.5l-.7.7m1.7 3.8h-1m-1.5 3.4l-.7-.7M4.4 11.8l.7-.7M2.5 7.5h-1m1.7-3.8l.7.7M3.5 7.5a3 3 0 016 0c0 1-.5 1.8-1.2 2.3v.7H4.7v-.7A2.9 2.9 0 013.5 7.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 18, color: "var(--ink)", letterSpacing: "-0.005em", lineHeight: 1.1 }}>Intel</div>
            <LabelMono style={{ fontSize: 9 }}>Request hints — costs points</LabelMono>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <Chip color="var(--bronze)" bg="white" border="rgba(140,109,54,0.20)">Hint −50</Chip>
          <Chip color="var(--danger)" bg="white" border="rgba(166,75,72,0.20)">Reveal −200</Chip>
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 10,
      }}>
        {targets.map((t, i) => {
          const u = unlocked[t.id] || 0;
          return (
            <div key={t.id} style={{
              border: `1px solid ${u > 0 ? "rgba(140,109,54,0.25)" : "var(--line)"}`,
              background: u > 0 ? "var(--bronze-soft)" : "rgba(255,255,255,0.5)",
              padding: "10px 12px",
              borderRadius: 12,
              transition: "all 240ms",
              minHeight: 92,
              display: "flex", flexDirection: "column",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <LabelMono style={{ fontSize: 9, color: u > 0 ? "var(--bronze)" : "var(--muted)" }}>
                  #{String(i + 1).padStart(2, "0")}
                </LabelMono>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: u === 2 ? "var(--danger)" : u === 1 ? "var(--bronze)" : "var(--line-strong)",
                }} />
              </div>
              <div style={{
                fontSize: 12, color: u > 0 ? "var(--ink-2)" : "var(--muted-2)",
                lineHeight: 1.4,
                flex: 1, marginBottom: 8,
                fontFamily: u === 0 ? "'Geist Mono', monospace" : "'Geist', sans-serif",
                letterSpacing: u === 0 ? "0.05em" : "0",
              }}>
                {u === 0 && "▒▒▒▒▒ ▒▒▒▒▒▒ ▒▒▒ ▒▒▒"}
                {u === 1 && t.hint}
                {u === 2 && t.truth.slice(0, 80) + "…"}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  className="btn ghost"
                  disabled={u >= 1}
                  onClick={() => onUnlock(t.id, 1)}
                  style={{ flex: 1, fontSize: 11, padding: "4px 8px" }}
                >Hint</button>
                <button
                  className="btn ghost"
                  disabled={u >= 2}
                  onClick={() => onUnlock(t.id, 2)}
                  style={{ flex: 1, fontSize: 11, padding: "4px 8px", color: u >= 2 ? "" : "var(--danger)" }}
                >Reveal</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
