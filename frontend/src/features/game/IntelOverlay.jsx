/**
 * IntelOverlay — full-screen "Briefing room" modal where the player buys
 * hints (−50) or reveals (−200) per hidden target. Ported from hud.jsx.
 */
import { LabelMono, Chip } from '../../components/ui';

export function IntelOverlay({ open, onClose, targets, unlocked, revealed = {}, onUnlock }) {
  // `targets` ne sont que des numéros : le joueur sait COMBIEN de
  // paragraphes sont falsifiés, jamais lesquels. Chaque case se remplit
  // quand le serveur a facturé et livré l'indice correspondant.
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 90,
        background: "rgba(246, 244, 239, 0.55)",
        backdropFilter: "blur(14px) saturate(180%)",
        WebkitBackdropFilter: "blur(14px) saturate(180%)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "94px 28px 28px",
        animation: "fade-in 200ms ease-out",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-strong"
        style={{
          background: "rgba(255, 255, 255, 0.88)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          border: "1px solid var(--line)",
          borderRadius: 22,
          width: "min(900px, 100%)",
          boxShadow: "0 30px 80px -20px rgba(24,24,27,0.22)",
          padding: "20px 22px",
          animation: "stagger-in 320ms cubic-bezier(.2,.6,.2,1) both",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              width: 36, height: 36, borderRadius: 10,
              background: "var(--bronze-soft)", color: "var(--bronze)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 2v1.4m5.7 2.1l-1 1M16 10h-1.4m-2.1 4.6l-1-1M5.4 14.6l1-1M3.4 10H2m2.3-4.5l1 1M5 10a4 4 0 118 0c0 1.5-.8 2.7-2 3.4v1H7v-1A4 4 0 015 10z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <LabelMono style={{ fontSize: 9 }}>Intel — acheter un indice</LabelMono>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 26, color: "var(--ink)", lineHeight: 1.1, letterSpacing: "-0.01em" }}>
                Briefing room
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Chip color="var(--bronze)" bg="white" border="rgba(140,109,54,0.20)">Hint −50</Chip>
            <Chip color="var(--danger)" bg="white" border="rgba(166,75,72,0.20)">Reveal −200</Chip>
            <button onClick={onClose} className="btn-icon" aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 10,
        }}>
          {targets.map((t) => {
            const u = unlocked[t.number] || 0;
            const hint = revealed[t.number]?.hint || '';
            const truth = revealed[t.number]?.truth || '';
            return (
              <div key={t.id} style={{
                border: `1px solid ${u > 0 ? "rgba(140,109,54,0.25)" : "var(--line)"}`,
                background: u > 0 ? "var(--bronze-soft)" : "rgba(255,255,255,0.6)",
                padding: "12px 14px",
                borderRadius: 14,
                transition: "all 240ms",
                minHeight: 104,
                display: "flex", flexDirection: "column",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <LabelMono style={{ fontSize: 9, color: u > 0 ? "var(--bronze)" : "var(--muted)" }}>
                    Cible #{String(t.number).padStart(2, "0")}
                  </LabelMono>
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: u === 2 ? "var(--danger)" : u === 1 ? "var(--bronze)" : "var(--line-strong)",
                  }} />
                </div>
                <div style={{
                  fontSize: 12.5, color: u > 0 ? "var(--ink-2)" : "var(--muted-2)",
                  lineHeight: 1.45,
                  flex: 1, marginBottom: 10,
                  fontFamily: u === 0 ? "'Geist Mono', monospace" : "'Geist', sans-serif",
                  letterSpacing: u === 0 ? "0.06em" : "0",
                }}>
                  {u === 0 && "▒▒▒▒▒ ▒▒▒▒▒▒ ▒▒▒ ▒▒▒"}
                  {u === 1 && hint}
                  {u === 2 && (truth ? truth.slice(0, 90) + "…" : hint)}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    className="btn ghost"
                    disabled={u >= 1}
                    onClick={() => onUnlock(t.number, 1)}
                    style={{ flex: 1, fontSize: 11, padding: "5px 10px" }}
                  >Indice</button>
                  <button
                    className="btn ghost"
                    disabled={u >= 2}
                    onClick={() => onUnlock(t.number, 2)}
                    style={{ flex: 1, fontSize: 11, padding: "5px 10px", color: u >= 2 ? "" : "var(--danger)" }}
                  >Révéler</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
