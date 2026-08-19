/**
 * TopBar — sticky game header: logo, mode chip, Intel/Brief buttons, timer,
 * marked-count ring and the Submit/Annuler action. Ported from hud.jsx;
 * the logo now comes from LOGO_SRC instead of a hard-coded /public path.
 */
import { LOGO_SRC } from '../../config';
import { LabelMono, PulseDot, Ring, Chip } from '../../components/ui';

export function TopBar({ mode, marked, total, time, onSubmit, onUnsubmit, target, progress, canSubmit, waiting, onOpenIntel, onOpenBrief, hintsUsed, onLogoClick }) {
  const min = Math.floor(time / 60);
  const sec = time % 60;
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 80,
      background: "rgba(246, 244, 239, 0.82)",
      backdropFilter: "blur(24px) saturate(180%)",
      WebkitBackdropFilter: "blur(24px) saturate(180%)",
      borderBottom: "1px solid var(--line)",
    }}>
      <div style={{
        maxWidth: 1320, margin: "0 auto",
        padding: "16px 28px",
        display: "grid",
        gridTemplateColumns: "auto auto 1fr auto auto auto auto",
        alignItems: "center",
        gap: 24,
      }}>
        {/* Big logo */}
        <div
          onClick={onLogoClick || undefined}
          style={{
            display: "flex", alignItems: "center", gap: 14,
            cursor: onLogoClick ? "pointer" : "default",
          }}
        >
          <div style={{
            width: 44, height: 44,
            borderRadius: 12,
            background: "linear-gradient(135deg, var(--accent), #2a7568)",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
            boxShadow: "0 4px 12px rgba(31, 87, 77, 0.22), inset 0 1px 0 rgba(255,255,255,0.18)",
          }}>
            <img src={LOGO_SRC} style={{
              width: "100%", height: "100%",
              objectFit: "cover",
              borderRadius: 12,
            }} alt="Wikifake logo" />
          </div>
          <span style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: 30,
            fontWeight: 400,
            letterSpacing: "-0.012em",
            color: "var(--ink)",
            lineHeight: 1,
          }}>Wikifake</span>
        </div>

        {/* Target chip */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Chip color="var(--accent)" bg="var(--accent-soft)" border="var(--accent-line)">
            <PulseDot color="var(--accent)" size={5} />
            {mode === "expert" ? "Expert" : "Normal"}
          </Chip>
        </div>

        <span />

        {/* Intel button */}
        <button className="btn ghost" onClick={onOpenIntel} style={{ position: "relative", padding: "7px 14px" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1.5v1m4.2 1.6l-.7.7M12.5 8h-1m-1.5 3.4l-.7-.7M4.4 11.8l.7-.7M2.5 8h-1m1.7-3.9l.7.7M3.5 7.5a3.5 3.5 0 117 0c0 1.1-.6 2-1.5 2.5v.7H5v-.7A3.5 3.5 0 013.5 7.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Intel
          {hintsUsed > 0 && (
            <span style={{
              position: "absolute", top: -4, right: -4,
              minWidth: 16, height: 16, padding: "0 4px",
              borderRadius: 999,
              background: "var(--bronze)", color: "white",
              fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>{hintsUsed}</span>
          )}
        </button>

        {/* Brief button */}
        {onOpenBrief && (
          <button className="btn ghost" onClick={onOpenBrief} style={{ padding: "7px 14px" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 3h10M2 7h10M2 11h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Brief
          </button>
        )}

        {/* Timer */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0, minWidth: 56 }}>
          <LabelMono style={{ fontSize: 9 }}>Time</LabelMono>
          <span style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 18, fontWeight: 500,
            color: time < 30 ? "var(--danger)" : time < 90 ? "var(--warn)" : "var(--ink)",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.02em",
          }}>{String(Math.floor(time / 60)).padStart(2, "0")}:{String(time % 60).padStart(2, "0")}</span>
        </div>

        {/* Marked count */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Ring value={marked} max={total} size={36} stroke={2.5}>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 600, color: "var(--ink)" }}>
              {marked}
            </span>
          </Ring>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
            <LabelMono>Marked</LabelMono>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>of {total}</span>
          </div>
        </div>

        {/* Submit */}
        {waiting ? (
          <button className="btn ghost" onClick={onUnsubmit} style={{ color: "var(--danger)", borderColor: "var(--danger-soft)", padding: "9px 20px" }}>
            Annuler
          </button>
        ) : (
          <button className="btn primary" onClick={onSubmit} disabled={!canSubmit}>
            Submit
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M3 6.5h7M6.5 3l3.5 3.5L6.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
