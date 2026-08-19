import React, { useEffect, useRef, useMemo } from 'react';

export function BlizzardEffect({ active }) {
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
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(0,8,35,0.60)",
        animation: "frost-pulse 1.4s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at center, rgba(0,20,80,0.15) 15%, rgba(0,5,50,0.80) 100%)",
        boxShadow: "inset 0 0 140px rgba(10,60,200,0.65), inset 0 0 0 10px rgba(80,160,255,0.5)",
      }} />
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
      <div style={{
        position: "absolute", inset: 0,
        boxShadow: "inset 0 0 0 10px rgba(100,190,255,0.65), inset 0 0 0 20px rgba(40,110,255,0.25)",
      }} />
    </div>
  );
}

export function LightningEffect({ active }) {
  if (!active) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 150, pointerEvents: "none", overflow: "hidden" }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(8,4,0,0.70)",
        animation: "screen-flash 0.45s ease-in-out infinite",
      }} />
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
      <div style={{
        position: "absolute", inset: 0,
        boxShadow: "inset 0 0 0 7px rgba(255,210,0,0.75), inset 0 0 80px rgba(255,140,0,0.35), inset 0 0 160px rgba(200,80,0,0.20)",
      }} />
    </div>
  );
}

export function StaticEffect({ active }) {
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
      if (now - last < 40) return; 
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
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.50)" }} />
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.45) 0px, rgba(0,0,0,0.45) 2px, transparent 2px, transparent 4px)",
      }} />
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
      <div style={{
        position: "absolute", inset: 0,
        boxShadow: "inset 0 0 0 10px rgba(10,10,10,0.95), inset 0 0 140px rgba(0,0,0,0.75)",
      }} />
    </div>
  );
}

export function FogEffect({ active }) {
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
      <div style={{ position: "absolute", inset: 0, background: "rgba(2,2,2,0.68)" }} />
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
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at center, transparent 10%, rgba(0,0,0,0.75) 75%)",
        boxShadow: "inset 0 0 0 8px rgba(0,0,0,0.95)",
      }} />
    </div>
  );
}

export function EarthquakeEffect({ active }) {
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
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(60,8,0,0.72)",
        animation: "screen-flash 0.25s ease-in-out infinite",
      }} />
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
      <div style={{
        position: "absolute", inset: 0,
        boxShadow: "inset 0 0 0 8px rgba(255,70,0,0.80), inset 0 0 80px rgba(200,40,0,0.45), inset 0 0 200px rgba(100,10,0,0.35)",
      }} />
    </div>
  );
}

export function BlackoutEffect({ active }) {
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
      <div style={{ position: "absolute", inset: 0, background: "rgba(4,4,4,0.82)" }} />
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.30) 0px, rgba(0,0,0,0.30) 1px, transparent 1px, transparent 3px)",
      }} />
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
      <div style={{
        position: "absolute", inset: 0,
        boxShadow: "inset 0 0 0 8px rgba(180,0,0,0.50), inset 0 0 80px rgba(100,0,0,0.30)",
      }} />
    </div>
  );
}

export function ConfettiEffect({ active }) {
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
