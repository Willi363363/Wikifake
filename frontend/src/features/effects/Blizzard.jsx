/** Tempete de neige — malus FREEZE_TIME. */

import { useMemo } from 'react';

function BlizzardEffect({ active }) {
  const flakes = useMemo(() => Array.from({ length: 120 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: -(Math.random() * 5),
    duration: 1.5 + Math.random() * 2.5,
    size: 8 + Math.random() * 18,
    opacity: 0.75 + Math.random() * 0.25,
    drift: ((Math.random() - 0.5) * 100).toFixed(0),
  })), []);

  if (!active) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 150, pointerEvents: "none", overflow: "hidden" }}>
      {/* Dark blue-black base */}
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(0,8,35,0.60)",
        animation: "frost-pulse 1.4s ease-in-out infinite",
      }} />
      {/* Heavy radial frost */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at center, rgba(0,20,80,0.15) 15%, rgba(0,5,50,0.80) 100%)",
        boxShadow: "inset 0 0 140px rgba(10,60,200,0.65), inset 0 0 0 10px rgba(80,160,255,0.5)",
      }} />
      {/* Dense fast snowflakes */}
      {flakes.map(f => (
        <span key={f.id} style={{
          position: "absolute", left: `${f.left}%`, top: "-30px",
          fontSize: `${f.size}px`,
          opacity: f.opacity,
          color: "rgba(180,225,255,1)",
          textShadow: "0 0 10px rgba(120,200,255,1), 0 0 28px rgba(60,140,255,0.8)",
          animation: `snowfall ${f.duration}s ${f.delay}s linear infinite`,
          "--drift": `${f.drift}px`,
        }}>❄</span>
      ))}
      {/* -10s damage indicator */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: "clamp(60px, 14vw, 120px)",
          fontWeight: 900,
          color: "rgba(160,225,255,0.95)",
          textShadow: "0 0 30px rgba(80,180,255,0.9), 0 0 80px rgba(40,120,255,0.55), 0 6px 40px rgba(0,0,0,0.9)",
          animation: "damage-pop 3s ease-out forwards",
          letterSpacing: "-0.04em",
          userSelect: "none",
        }}>-10s</span>
      </div>
      {/* Ice crack border */}
      <div style={{
        position: "absolute", inset: 0,
        boxShadow: "inset 0 0 0 10px rgba(100,190,255,0.65), inset 0 0 0 20px rgba(40,110,255,0.25)",
      }} />
    </div>
  );
}

export default BlizzardEffect;
