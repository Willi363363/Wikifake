/** Confettis — malus CONFETTI. */

import { useMemo } from 'react';

function ConfettiEffect({ active }) {
  const pieces = useMemo(() => Array.from({ length: 80 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: -(Math.random() * 3),
    duration: 1.2 + Math.random() * 2,
    size: 8 + Math.random() * 14,
    color: ["#ff4d6d", "#ffd166", "#06d6a0", "#118ab2", "#a64ac9", "#ff9a3c", "#4cc9f0", "#f72585"][i % 8],
    rotate: Math.random() * 360,
    drift: ((Math.random() - 0.5) * 120).toFixed(0),
    shape: i % 3 === 0 ? "circle" : i % 3 === 1 ? "rect" : "triangle",
  })), []);

  if (!active) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 160, pointerEvents: "none", overflow: "hidden" }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: "absolute",
          left: `${p.left}%`, top: "-20px",
          width: p.shape === "rect" ? p.size * 1.6 : p.size,
          height: p.shape === "triangle" ? 0 : p.size,
          background: p.shape === "triangle" ? "transparent" : p.color,
          borderRadius: p.shape === "circle" ? "50%" : p.shape === "rect" ? 2 : 0,
          borderLeft: p.shape === "triangle" ? `${p.size / 2}px solid transparent` : undefined,
          borderRight: p.shape === "triangle" ? `${p.size / 2}px solid transparent` : undefined,
          borderBottom: p.shape === "triangle" ? `${p.size}px solid ${p.color}` : undefined,
          opacity: 0.92,
          animation: `snowfall ${p.duration}s ${p.delay}s linear infinite`,
          "--drift": `${p.drift}px`,
          transform: `rotate(${p.rotate}deg)`,
        }} />
      ))}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: "clamp(28px, 6vw, 56px)",
          fontWeight: 900, letterSpacing: "0.1em",
          color: "rgba(255,255,255,0.92)",
          textShadow: "0 0 20px rgba(255,80,160,0.8), 0 0 60px rgba(255,200,0,0.5), 0 4px 20px rgba(0,0,0,0.7)",
          animation: "damage-pop 6s ease-out forwards",
          userSelect: "none",
        }}>🎊 FÊTE SURPRISE !</span>
      </div>
    </div>
  );
}

// ============ Item Bar ============

export default ConfettiEffect;
