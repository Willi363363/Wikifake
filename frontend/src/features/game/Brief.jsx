/** Panneau lateral de briefing. */

import LabelMono from '@/ui/LabelMono';

function Brief({ onClose, children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "fade-in 200ms ease",
    }} onClick={onClose}>
      <div style={{
        background: "white",
        borderRadius: 16,
        padding: "24px 32px",
        width: 440,
        maxHeight: "85vh",
        overflowY: "auto",
        boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
        display: "flex", flexDirection: "column", gap: 24,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              width: 32, height: 32, flexShrink: 0,
              borderRadius: "50%",
              background: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white",
            }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                <path d="M7 1l1.5 4.5L13 7l-4.5 1.5L7 13l-1.5-4.5L1 7l4.5-1.5L7 1z" fill="currentColor"/>
              </svg>
            </span>
            <div>
              <LabelMono style={{ color: "var(--accent)", fontSize: 10 }}>Briefing</LabelMono>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", lineHeight: 1.2 }}>
                Objectif & Intel
              </div>
            </div>
          </div>
          <button className="btn ghost" onClick={onClose} style={{ padding: 6 }}>
             <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ============ Floating leaderboard — sticky, expands on hover ============ */

export default Brief;
