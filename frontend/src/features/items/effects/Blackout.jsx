/**
 * Full-screen "censored document" overlay for the BLACKOUT malus.
 *
 * Redaction bar geometry is memoised once so the bars do not reshuffle;
 * they slide in with the `stagger-in` keyframe.
 */
import { useMemo } from 'react';

export function Blackout({ active }) {
  const bars = useMemo(() => Array.from({ length: 7 }, (_, i) => ({
    id: i,
    top: 12 + i * 12,
    width: 55 + Math.random() * 40,
    left: Math.random() * 10,
    delay: i * 0.07,
  })), []);

  if (!active) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 150, pointerEvents: "none", overflow: "hidden" }}>
      {/* Dark base */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(4,4,4,0.82)" }} />
      {/* Scanlines */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.30) 0px, rgba(0,0,0,0.30) 1px, transparent 1px, transparent 3px)",
      }} />
      {/* Redaction bars */}
      {bars.map(b => (
        <div key={b.id} style={{
          position: "absolute",
          top: `${b.top}%`, left: `${b.left}%`,
          width: `${b.width}%`, height: "clamp(18px,2.5vw,28px)",
          background: "#0a0a0a",
          border: "1px solid rgba(255,255,255,0.06)",
          animation: `stagger-in 0.3s ${b.delay}s both`,
        }} />
      ))}
      {/* CENTER STAMP */}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <div style={{
          border: "5px solid rgba(200,0,0,0.85)",
          padding: "12px 28px",
          transform: "rotate(-8deg)",
          boxShadow: "0 0 28px rgba(200,0,0,0.40)",
        }}>
          <span style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: "clamp(22px, 5vw, 48px)",
            fontWeight: 900, letterSpacing: "0.25em",
            color: "rgba(210,0,0,0.92)",
            textShadow: "0 0 20px rgba(255,0,0,0.5)",
            userSelect: "none",
          }}>CENSURÉ</span>
        </div>
        <span style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: "clamp(9px, 1.8vw, 14px)",
          letterSpacing: "0.4em",
          color: "rgba(140,140,140,0.55)",
          userSelect: "none",
        }}>CLASSIFIÉ — ACCÈS RESTREINT</span>
      </div>
      {/* Red corner stamp */}
      <div style={{
        position: "absolute", top: 24, right: 32,
        border: "3px solid rgba(200,0,0,0.7)",
        padding: "4px 10px",
        transform: "rotate(12deg)",
      }}>
        <span style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 11, letterSpacing: "0.2em",
          color: "rgba(200,0,0,0.8)", userSelect: "none",
        }}>TOP SECRET</span>
      </div>
      {/* Border */}
      <div style={{
        position: "absolute", inset: 0,
        boxShadow: "inset 0 0 0 8px rgba(180,0,0,0.50), inset 0 0 80px rgba(100,0,0,0.30)",
      }} />
    </div>
  );
}
