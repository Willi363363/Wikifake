/**
 * Full-screen fog overlay for the BLUR malus.
 *
 * Blob positions are generated once (useMemo) so the fog stays coherent
 * across renders; the drift comes from the `fog-drift` keyframe.
 */
import { useMemo } from 'react';

export function Fog({ active }) {
  const blobs = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    id: i,
    x: Math.random() * 110 - 5,
    y: Math.random() * 110 - 5,
    size: 260 + Math.random() * 380,
    delay: -(Math.random() * 8),
    duration: 3.5 + Math.random() * 4,
    driftX: ((Math.random() - 0.5) * 150).toFixed(0),
    driftY: ((Math.random() - 0.5) * 90).toFixed(0),
  })), []);

  if (!active) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 150, pointerEvents: "none", overflow: "hidden" }}>
      {/* Near-black base */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(2,2,2,0.68)" }} />
      {/* Dark charcoal fog blobs */}
      {blobs.map(b => (
        <div key={b.id} style={{
          position: "absolute",
          left: `${b.x}%`, top: `${b.y}%`,
          width: b.size, height: b.size,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(28,28,28,0.80) 0%, rgba(8,8,8,0.50) 55%, transparent 100%)",
          transform: "translate(-50%, -50%)",
          animation: `fog-drift ${b.duration}s ${b.delay}s ease-in-out infinite alternate`,
          "--driftX": `${b.driftX}px`,
          "--driftY": `${b.driftY}px`,
        }} />
      ))}
      {/* BROUILLARD text */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: "clamp(18px, 5vw, 48px)",
          fontWeight: 700, letterSpacing: "0.45em",
          color: "rgba(70,70,70,0.45)",
          textTransform: "uppercase",
          userSelect: "none",
          animation: "frost-pulse 2.2s ease-in-out infinite",
        }}>BROUILLARD</span>
      </div>
      {/* Dark vignette */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at center, transparent 10%, rgba(0,0,0,0.75) 75%)",
        boxShadow: "inset 0 0 0 8px rgba(0,0,0,0.95)",
      }} />
    </div>
  );
}
