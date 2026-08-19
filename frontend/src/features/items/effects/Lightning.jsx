/**
 * Full-screen thunderstorm overlay for the SCORE_STEAL malus.
 *
 * Pure SVG bolts staggered on the `lightning-zap` keyframe; no per-render
 * state, so no hooks needed.
 */
export function Lightning({ active }) {
  if (!active) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 150, pointerEvents: "none", overflow: "hidden" }}>
      {/* Near-black flash */}
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(8,4,0,0.70)",
        animation: "screen-flash 0.45s ease-in-out infinite",
      }} />
      {/* Bolts */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points="15,0 9,33 23,33 4,100" stroke="rgba(255,235,60,1)" strokeWidth="0.7" fill="none"
          filter="url(#glow)" style={{ animation: "lightning-zap 0.45s ease-in-out infinite" }} />
        <polyline points="86,0 92,28 77,28 96,100" stroke="rgba(255,250,120,0.95)" strokeWidth="0.55" fill="none"
          style={{ animation: "lightning-zap 0.45s 0.13s ease-in-out infinite" }} />
        <polyline points="50,0 42,24 58,24 34,58 66,58 47,100" stroke="rgba(255,255,190,1)" strokeWidth="0.8" fill="none"
          style={{ animation: "lightning-zap 0.45s 0.07s ease-in-out infinite" }} />
        <polyline points="27,0 22,44 38,44 16,100" stroke="rgba(230,170,255,0.9)" strokeWidth="0.45" fill="none"
          style={{ animation: "lightning-zap 0.45s 0.28s ease-in-out infinite" }} />
        <polyline points="73,0 79,40 64,40 83,100" stroke="rgba(255,195,55,0.85)" strokeWidth="0.45" fill="none"
          style={{ animation: "lightning-zap 0.45s 0.20s ease-in-out infinite" }} />
        <polyline points="38,0 33,52 44,52 28,100" stroke="rgba(255,230,90,0.7)" strokeWidth="0.35" fill="none"
          style={{ animation: "lightning-zap 0.45s 0.38s ease-in-out infinite" }} />
        <polyline points="62,0 68,46 57,46 74,100" stroke="rgba(210,185,255,0.7)" strokeWidth="0.35" fill="none"
          style={{ animation: "lightning-zap 0.45s 0.33s ease-in-out infinite" }} />
      </svg>
      {/* -50pts damage indicator */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: "clamp(60px, 14vw, 120px)",
          fontWeight: 900,
          color: "rgba(255,220,40,0.98)",
          textShadow: "0 0 30px rgba(255,160,0,0.95), 0 0 80px rgba(255,80,0,0.55), 0 6px 40px rgba(0,0,0,0.95)",
          animation: "damage-pop 3s ease-out forwards",
          letterSpacing: "-0.04em",
          userSelect: "none",
        }}>-50pts</span>
      </div>
      {/* Electric border */}
      <div style={{
        position: "absolute", inset: 0,
        boxShadow: "inset 0 0 0 7px rgba(255,210,0,0.75), inset 0 0 80px rgba(255,140,0,0.35), inset 0 0 160px rgba(200,80,0,0.20)",
      }} />
    </div>
  );
}
