/**
 * Full-screen TV-static overlay for the HINT_LOCK malus.
 *
 * The noise is drawn on a canvas via requestAnimationFrame (throttled to
 * ~25 fps). The useEffect runs BEFORE the `!active` guard on purpose: hooks
 * must be called on every render, so the effect itself bails when inactive.
 */
import { useEffect, useRef } from 'react';

export function Static({ active }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let frame;
    let last = 0;

    const draw = (now) => {
      frame = requestAnimationFrame(draw);
      if (now - last < 40) return; // ~25 fps
      last = now;
      const w = canvas.width = window.innerWidth;
      const h = canvas.height = window.innerHeight;
      const imageData = ctx.createImageData(w, h);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = Math.random();
        if (r < 0.45) {
          data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 230;
        } else if (r < 0.02 + 0.45) {
          data[i] = 200; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 160;
        } else if (r < 0.02 + 0.02 + 0.45) {
          data[i] = 0; data[i + 1] = 80; data[i + 2] = 220; data[i + 3] = 120;
        } else {
          const v = Math.floor(140 + Math.random() * 115);
          data[i] = v; data[i + 1] = v; data[i + 2] = v;
          data[i + 3] = Math.floor(160 + Math.random() * 95);
        }
      }
      // Horizontal glitch tears (more frequent, bigger)
      const tearCount = Math.random() < 0.4 ? Math.floor(1 + Math.random() * 4) : 0;
      for (let t = 0; t < tearCount; t++) {
        const y = Math.floor(Math.random() * h);
        const tearH = Math.floor(4 + Math.random() * 14);
        const shift = Math.floor((Math.random() - 0.5) * 80);
        for (let row = y; row < Math.min(y + tearH, h); row++) {
          for (let x = 0; x < w; x++) {
            const src = (row * w + Math.max(0, Math.min(w - 1, x + shift))) * 4;
            const dst = (row * w + x) * 4;
            data[dst] = data[src]; data[dst + 1] = data[src + 1];
            data[dst + 2] = data[src + 2]; data[dst + 3] = 240;
          }
        }
      }
      ctx.putImageData(imageData, 0, 0);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  if (!active) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 150, pointerEvents: "none", overflow: "hidden" }}>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      {/* Dark overlay */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.50)" }} />
      {/* Heavy scanlines */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.45) 0px, rgba(0,0,0,0.45) 2px, transparent 2px, transparent 4px)",
      }} />
      {/* INTEL BLOQUÉ */}
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 14,
      }}>
        <span style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: "clamp(16px, 3.5vw, 30px)",
          fontWeight: 700, letterSpacing: "0.35em", textTransform: "uppercase",
          color: "rgba(255,40,40,0.95)",
          textShadow: "4px 0 0 rgba(0,220,255,0.55), -4px 0 0 rgba(255,0,0,0.55), 0 0 24px rgba(255,0,0,0.5)",
          animation: "static-glitch 0.1s linear infinite",
          userSelect: "none",
        }}>⚠ INTEL BLOQUÉ ⚠</span>
        <span style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: "clamp(10px, 2vw, 17px)",
          fontWeight: 500, letterSpacing: "0.28em",
          color: "rgba(160,160,160,0.55)",
          animation: "static-glitch 0.18s 0.06s linear infinite",
          userSelect: "none",
        }}>NO SIGNAL</span>
      </div>
      {/* Heavy border vignette */}
      <div style={{
        position: "absolute", inset: 0,
        boxShadow: "inset 0 0 0 10px rgba(10,10,10,0.95), inset 0 0 140px rgba(0,0,0,0.75)",
      }} />
    </div>
  );
}
