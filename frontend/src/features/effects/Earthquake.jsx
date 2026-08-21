/** Secousse — malus EARTHQUAKE. */

import { useMemo } from 'react';

function EarthquakeEffect({ active }) {
  const debris = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 3 + Math.random() * 9,
    delay: -(Math.random() * 1.2),
    dur: 0.3 + Math.random() * 0.5,
    dx: ((Math.random() - 0.5) * 120).toFixed(0),
    dy: ((Math.random() - 0.5) * 80).toFixed(0),
  })), []);

  if (!active) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 150, pointerEvents: "none", overflow: "hidden" }}>
      {/* Dark red base flash */}
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(60,8,0,0.72)",
        animation: "screen-flash 0.25s ease-in-out infinite",
      }} />
      {/* Crack lines SVG */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points="50,50 38,30 44,18 35,0" stroke="rgba(255,90,20,0.85)" strokeWidth="0.6" fill="none" style={{ animation: "lightning-zap 0.3s ease-in-out infinite" }} />
        <polyline points="50,50 62,28 58,12 68,0" stroke="rgba(255,60,0,0.70)" strokeWidth="0.5" fill="none" style={{ animation: "lightning-zap 0.3s 0.08s ease-in-out infinite" }} />
        <polyline points="50,50 20,48 8,55 0,50" stroke="rgba(200,50,0,0.80)" strokeWidth="0.55" fill="none" style={{ animation: "lightning-zap 0.3s 0.05s ease-in-out infinite" }} />
        <polyline points="50,50 80,52 92,45 100,50" stroke="rgba(255,80,10,0.75)" strokeWidth="0.5" fill="none" style={{ animation: "lightning-zap 0.3s 0.12s ease-in-out infinite" }} />
        <polyline points="50,50 42,72 36,85 40,100" stroke="rgba(180,40,0,0.70)" strokeWidth="0.5" fill="none" style={{ animation: "lightning-zap 0.3s 0.09s ease-in-out infinite" }} />
        <polyline points="50,50 60,75 66,88 62,100" stroke="rgba(230,70,0,0.65)" strokeWidth="0.4" fill="none" style={{ animation: "lightning-zap 0.3s 0.15s ease-in-out infinite" }} />
        <polyline points="50,50 25,60 12,70 0,75" stroke="rgba(255,40,0,0.60)" strokeWidth="0.35" fill="none" style={{ animation: "lightning-zap 0.3s 0.18s ease-in-out infinite" }} />
        <polyline points="50,50 76,68 88,80 100,85" stroke="rgba(200,60,10,0.60)" strokeWidth="0.35" fill="none" style={{ animation: "lightning-zap 0.3s 0.22s ease-in-out infinite" }} />
      </svg>
      {/* Debris particles */}
      {debris.map(d => (
        <div key={d.id} style={{
          position: "absolute",
          left: `${d.x}%`, top: `${d.y}%`,
          width: d.size, height: d.size * 0.4,
          background: `rgba(${120 + Math.floor(Math.random() * 80)},${40 + Math.floor(Math.random() * 30)},0,0.85)`,
          borderRadius: 1,
          transform: `rotate(${Math.random() * 360}deg)`,
          animation: `fog-drift ${d.dur}s ${d.delay}s ease-in-out infinite alternate`,
          "--driftX": `${d.dx}px`,
          "--driftY": `${d.dy}px`,
        }} />
      ))}
      {/* SÉISME text */}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <span style={{
          fontSize: "clamp(16px, 4vw, 36px)",
          fontFamily: "'Geist Mono', monospace",
          fontWeight: 900, letterSpacing: "0.3em",
          color: "rgba(255,80,10,0.95)",
          textShadow: "0 0 20px rgba(255,60,0,0.9), 0 0 60px rgba(200,30,0,0.6)",
          animation: "static-glitch 0.08s linear infinite",
          userSelect: "none",
        }}>🌋 SÉISME</span>
        <span style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: "clamp(60px, 14vw, 110px)",
          fontWeight: 900,
          color: "rgba(255,70,10,0.98)",
          textShadow: "0 0 30px rgba(255,80,0,0.9), 0 0 80px rgba(180,30,0,0.55), 0 6px 40px rgba(0,0,0,0.95)",
          animation: "damage-pop 5s ease-out forwards",
          letterSpacing: "-0.04em", userSelect: "none",
        }}>-5s</span>
      </div>
      {/* Lava border glow */}
      <div style={{
        position: "absolute", inset: 0,
        boxShadow: "inset 0 0 0 8px rgba(255,70,0,0.80), inset 0 0 80px rgba(200,40,0,0.45), inset 0 0 200px rgba(100,10,0,0.35)",
      }} />
    </div>
  );
}

export default EarthquakeEffect;
