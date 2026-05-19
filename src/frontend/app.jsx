/* WIKIFAKE — refined main app */
/* global React, ReactDOM, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakSlider, TweakButton, TweakSelect, TweakColor */
/* global TopBar, SubjectCard, MissionCard, Leaderboard, BotCursor, HintsPanel, Brief, Footer, Debrief, LabelMono, Chip, HairProgress, PulseDot, SideDrawer, FloatingLeaderboard, IntelOverlay */
/* global WIKIFAKE_ARTICLE, WIKIFAKE_BODY, WIKIFAKE_INFOBOX, window.WIKIFAKE_FAKES */

const { useState, useEffect, useRef, useMemo, useCallback } = React;

const GAME_DURATION = 300; // 5 minutes

const ITEM_DEFS = {
  BLUR:        { icon: "👁",  name: "Brouillard",   description: "Floute l'écran d'un joueur 5s",    color: "#6b4e6f" },
  FREEZE_TIME: { icon: "⏸",  name: "Gel du temps",  description: "Retire 10s au chrono d'un joueur", color: "#1f3a5f" },
  SCORE_STEAL: { icon: "⚡",  name: "Pillage",       description: "Vole 50 pts à un joueur",          color: "#8c6d36" },
  HINT_LOCK:   { icon: "🔒", name: "Brouilleur",    description: "Bloque les hints 20s",              color: "#27272a" },
  BLACKOUT:    { icon: "⬛", name: "Censure CIA",   description: "Censure le texte d'un joueur 5s",   color: "#18181b" },
  EARTHQUAKE:  { icon: "🌋", name: "Séisme",        description: "Fait trembler l'écran 5s",          color: "#a64b48" },
  RICKROLL:    { icon: "🤡", name: "Pop-up Spam",   description: "Affiche un pop-up gênant",          color: "#b58f3a" },
  SCANNER:     { icon: "🔎", name: "Détecteur",     description: "Surligne un paragraphe suspect",    color: "#4a7a52", targetCount: 0 },
  MIRROR:      { icon: "🪞", name: "Miroir",        description: "Inverse le texte de l'article 6s",  color: "#4a6b8c" },
  TINY:        { icon: "🔬", name: "Loupe cassée",  description: "Rend le texte minuscule 8s",        color: "#7a5248" },
  SPIN:        { icon: "🌀", name: "Tournis",       description: "Fait tourner l'article 4s",         color: "#4a6b8c" },
  CONFETTI:    { icon: "🎊", name: "Fête surprise", description: "Explosion de confettis 6s",         color: "#8c6d36" },
  INVERT:      { icon: "🌑", name: "Négatif",       description: "Inverse les couleurs 5s",           color: "#27272a" },
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "mode": "normal",
  "difficulty": "medium",
  "multiplayer": true,
  "gameState": "playing",
  "showCursors": true,
  "accent": "teal",
  "sessionId": "A2-F1K9"
}/*EDITMODE-END*/;

const ACCENTS = {
  teal:    { primary: "#1f574d", hover: "#174841", soft: "#e8f0ed", line: "rgba(31, 87, 77, 0.18)" },
  navy:    { primary: "#1f3a5f", hover: "#162d4a", soft: "#e6ecf3", line: "rgba(31, 58, 95, 0.18)" },
  bronze:  { primary: "#8c6d36", hover: "#735829", soft: "#f4ecdb", line: "rgba(140, 109, 54, 0.20)" },
  aubergine:{ primary: "#6b4e6f", hover: "#553e58", soft: "#efe9f0", line: "rgba(107, 78, 111, 0.20)" },
  graphite:{ primary: "#27272a", hover: "#18181b", soft: "#ececec", line: "rgba(39, 39, 42, 0.18)" },
};

// ============ Token renderer ============
function ArticleToken({ id, text, fakeId, state, expertValue, mode, onClick, onEdit, status, hinted, scanned }) {
  const cls = ["token"];
  if (status === "found") cls.push("found");
  else if (status === "missed") cls.push("missed");
  else if (status === "false-positive") cls.push("false-positive");
  else if (state === "selected") cls.push("selected");
  else if (state === "edited") cls.push("edited");
  if (hinted && !status) cls.push("hinted");
  if (scanned && !status) cls.push("scanned");

  if (mode === "expert" && state === "edited") {
    return (
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
        <span style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 13, color: "var(--bronze)",
          textDecoration: "line-through",
          textDecorationColor: "rgba(140, 109, 54, 0.55)",
          opacity: 0.7,
        }}>{text}</span>
        <span style={{ color: "var(--bronze)", fontFamily: "'Geist Mono', monospace", fontSize: 11 }}>→</span>
        <input
          className="expert-input"
          value={expertValue}
          onChange={(e) => onEdit(id, e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") onEdit(id, null); }}
          autoFocus
          placeholder="correct value"
          style={{ minWidth: Math.max(80, expertValue.length * 8) + "px" }}
        />
      </span>
    );
  }

  return (
    <span
      className={cls.join(" ")}
      data-token-id={id}
      data-fake-id={fakeId || ""}
      onClick={(e) => { e.stopPropagation(); onClick(id, fakeId); }}
    >
      {text}
    </span>
  );
}

// ============ Render article body ============
function ArticleBody({ marked, edited, mode, hintedTokenIds, scannedParagraphs, onTokenClick, onTokenEdit, revealAll }) {
  return (
    <>
      {window.WIKIFAKE_BODY.map((block, bi) => (
        <div key={bi}>
          {block.heading && <h2>{block.heading}</h2>}
          {block.paragraphs.map((p, pi) => (
            <p key={pi}>
              {p.map((seg, si) => {
                if (typeof seg === "string") return <React.Fragment key={si}>{seg}</React.Fragment>;
                if (seg.kind === "link") return <a key={si} className="wikilink" href="#" onClick={(e) => e.preventDefault()}>{seg.text}</a>;
                if (seg.kind === "token") {
                  const m = marked[seg.id];
                  const ed = edited[seg.id];
                  const isFake = !!seg.fake;
                  let state = null;
                  if (m) state = "selected";
                  if (ed !== undefined && ed !== null) state = "edited";

                  let status = null;
                  if (revealAll) {
                    if (isFake && (m || (ed !== undefined && ed !== null))) status = "found";
                    else if (isFake) status = "missed";
                    else if (m || (ed !== undefined && ed !== null)) status = "false-positive";
                  }
                  const hinted = isFake && hintedTokenIds.has(seg.id) && !m && !ed;
                  const scanned = isFake && scannedParagraphs.has(seg.id) && !m && !ed;

                  return (
                    <ArticleToken
                      key={si}
                      id={seg.id}
                      text={seg.text}
                      fakeId={seg.fake?.id}
                      state={state}
                      expertValue={ed || ""}
                      mode={mode}
                      onClick={onTokenClick}
                      onEdit={onTokenEdit}
                      status={status}
                      hinted={hinted}
                      scanned={scanned}
                    />
                  );
                }
                return null;
              })}
            </p>
          ))}
        </div>
      ))}
    </>
  );
}

// ============ Bots simulation ============
const BOT_PROFILES = {
  alice:  { tp: 6, fp: 1, hintsUsed: 1, timeBonus: 72 },   // strong solver
  morgan: { tp: 5, fp: 2, hintsUsed: 0, timeBonus: 54 },   // fast but reckless
  noor:   { tp: 4, fp: 0, hintsUsed: 2, timeBonus: 88 },   // careful, leans on hints
};

function useBots(playing, totalFakes) {
  const [bots, setBots] = useState([
    { id: "alice", name: "Alice", color: "#c4548a", score: 0, x: 320, y: 600 },
    { id: "morgan", name: "Morgan", color: "#7a9460", score: 0, x: 540, y: 820 },
    { id: "noor",  name: "Noor", color: "#d68842", score: 0, x: 200, y: 900 },
  ]);

  useEffect(() => {
    if (!playing) return;
    const moveInt = setInterval(() => {
      setBots(prev => prev.map(b => {
        const dx = (Math.random() - 0.5) * 240;
        const dy = (Math.random() - 0.5) * 280;
        return {
          ...b,
          x: Math.max(80, Math.min(720, b.x + dx)),
          y: Math.max(400, Math.min(1600, b.y + dy)),
        };
      }));
    }, 2200);
    const scoreInt = setInterval(() => {
      setBots(prev => prev.map(b => {
        const advance = Math.random() < 0.35 ? 1 : 0;
        return {
          ...b,
          score: b.score + (advance ? Math.floor(80 + Math.random() * 70) : Math.floor(Math.random() * 6)),
        };
      }));
    }, 2400);
    return () => { clearInterval(moveInt); clearInterval(scoreInt); };
  }, [playing, totalFakes]);

  return bots;
}

// ============ Visual Effects ============

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
      }}/>
      {/* Heavy radial frost */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at center, rgba(0,20,80,0.15) 15%, rgba(0,5,50,0.80) 100%)",
        boxShadow: "inset 0 0 140px rgba(10,60,200,0.65), inset 0 0 0 10px rgba(80,160,255,0.5)",
      }}/>
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
      }}/>
    </div>
  );
}

function LightningEffect({ active }) {
  if (!active) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 150, pointerEvents: "none", overflow: "hidden" }}>
      {/* Near-black flash */}
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(8,4,0,0.70)",
        animation: "screen-flash 0.45s ease-in-out infinite",
      }}/>
      {/* Bolts */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
           viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points="15,0 9,33 23,33 4,100" stroke="rgba(255,235,60,1)" strokeWidth="0.7" fill="none"
                  filter="url(#glow)" style={{ animation: "lightning-zap 0.45s ease-in-out infinite" }}/>
        <polyline points="86,0 92,28 77,28 96,100" stroke="rgba(255,250,120,0.95)" strokeWidth="0.55" fill="none"
                  style={{ animation: "lightning-zap 0.45s 0.13s ease-in-out infinite" }}/>
        <polyline points="50,0 42,24 58,24 34,58 66,58 47,100" stroke="rgba(255,255,190,1)" strokeWidth="0.8" fill="none"
                  style={{ animation: "lightning-zap 0.45s 0.07s ease-in-out infinite" }}/>
        <polyline points="27,0 22,44 38,44 16,100" stroke="rgba(230,170,255,0.9)" strokeWidth="0.45" fill="none"
                  style={{ animation: "lightning-zap 0.45s 0.28s ease-in-out infinite" }}/>
        <polyline points="73,0 79,40 64,40 83,100" stroke="rgba(255,195,55,0.85)" strokeWidth="0.45" fill="none"
                  style={{ animation: "lightning-zap 0.45s 0.20s ease-in-out infinite" }}/>
        <polyline points="38,0 33,52 44,52 28,100" stroke="rgba(255,230,90,0.7)" strokeWidth="0.35" fill="none"
                  style={{ animation: "lightning-zap 0.45s 0.38s ease-in-out infinite" }}/>
        <polyline points="62,0 68,46 57,46 74,100" stroke="rgba(210,185,255,0.7)" strokeWidth="0.35" fill="none"
                  style={{ animation: "lightning-zap 0.45s 0.33s ease-in-out infinite" }}/>
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
      }}/>
    </div>
  );
}

function StaticEffect({ active }) {
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
          data[i] = 0; data[i+1] = 0; data[i+2] = 0; data[i+3] = 230;
        } else if (r < 0.02 + 0.45) {
          data[i] = 200; data[i+1] = 0; data[i+2] = 0; data[i+3] = 160;
        } else if (r < 0.02 + 0.02 + 0.45) {
          data[i] = 0; data[i+1] = 80; data[i+2] = 220; data[i+3] = 120;
        } else {
          const v = Math.floor(140 + Math.random() * 115);
          data[i] = v; data[i+1] = v; data[i+2] = v;
          data[i+3] = Math.floor(160 + Math.random() * 95);
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
            data[dst] = data[src]; data[dst+1] = data[src+1];
            data[dst+2] = data[src+2]; data[dst+3] = 240;
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
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}/>
      {/* Dark overlay */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.50)" }}/>
      {/* Heavy scanlines */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.45) 0px, rgba(0,0,0,0.45) 2px, transparent 2px, transparent 4px)",
      }}/>
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
      }}/>
    </div>
  );
}

function FogEffect({ active }) {
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
      <div style={{ position: "absolute", inset: 0, background: "rgba(2,2,2,0.68)" }}/>
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
        }}/>
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
      }}/>
    </div>
  );
}

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
      }}/>
      {/* Crack lines SVG */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points="50,50 38,30 44,18 35,0"   stroke="rgba(255,90,20,0.85)" strokeWidth="0.6" fill="none" style={{ animation: "lightning-zap 0.3s ease-in-out infinite" }}/>
        <polyline points="50,50 62,28 58,12 68,0"   stroke="rgba(255,60,0,0.70)"  strokeWidth="0.5" fill="none" style={{ animation: "lightning-zap 0.3s 0.08s ease-in-out infinite" }}/>
        <polyline points="50,50 20,48 8,55 0,50"    stroke="rgba(200,50,0,0.80)"  strokeWidth="0.55" fill="none" style={{ animation: "lightning-zap 0.3s 0.05s ease-in-out infinite" }}/>
        <polyline points="50,50 80,52 92,45 100,50"  stroke="rgba(255,80,10,0.75)" strokeWidth="0.5" fill="none" style={{ animation: "lightning-zap 0.3s 0.12s ease-in-out infinite" }}/>
        <polyline points="50,50 42,72 36,85 40,100"  stroke="rgba(180,40,0,0.70)"  strokeWidth="0.5" fill="none" style={{ animation: "lightning-zap 0.3s 0.09s ease-in-out infinite" }}/>
        <polyline points="50,50 60,75 66,88 62,100"  stroke="rgba(230,70,0,0.65)"  strokeWidth="0.4" fill="none" style={{ animation: "lightning-zap 0.3s 0.15s ease-in-out infinite" }}/>
        <polyline points="50,50 25,60 12,70 0,75"    stroke="rgba(255,40,0,0.60)"  strokeWidth="0.35" fill="none" style={{ animation: "lightning-zap 0.3s 0.18s ease-in-out infinite" }}/>
        <polyline points="50,50 76,68 88,80 100,85"  stroke="rgba(200,60,10,0.60)" strokeWidth="0.35" fill="none" style={{ animation: "lightning-zap 0.3s 0.22s ease-in-out infinite" }}/>
      </svg>
      {/* Debris particles */}
      {debris.map(d => (
        <div key={d.id} style={{
          position: "absolute",
          left: `${d.x}%`, top: `${d.y}%`,
          width: d.size, height: d.size * 0.4,
          background: `rgba(${120 + Math.floor(Math.random()*80)},${40 + Math.floor(Math.random()*30)},0,0.85)`,
          borderRadius: 1,
          transform: `rotate(${Math.random() * 360}deg)`,
          animation: `fog-drift ${d.dur}s ${d.delay}s ease-in-out infinite alternate`,
          "--driftX": `${d.dx}px`,
          "--driftY": `${d.dy}px`,
        }}/>
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
      }}/>
    </div>
  );
}

function BlackoutEffect({ active }) {
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
      <div style={{ position: "absolute", inset: 0, background: "rgba(4,4,4,0.82)" }}/>
      {/* Scanlines */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.30) 0px, rgba(0,0,0,0.30) 1px, transparent 1px, transparent 3px)",
      }}/>
      {/* Redaction bars */}
      {bars.map(b => (
        <div key={b.id} style={{
          position: "absolute",
          top: `${b.top}%`, left: `${b.left}%`,
          width: `${b.width}%`, height: "clamp(18px,2.5vw,28px)",
          background: "#0a0a0a",
          border: "1px solid rgba(255,255,255,0.06)",
          animation: `stagger-in 0.3s ${b.delay}s both`,
        }}/>
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
      }}/>
    </div>
  );
}

function ConfettiEffect({ active }) {
  const pieces = useMemo(() => Array.from({ length: 80 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: -(Math.random() * 3),
    duration: 1.2 + Math.random() * 2,
    size: 8 + Math.random() * 14,
    color: ["#ff4d6d","#ffd166","#06d6a0","#118ab2","#a64ac9","#ff9a3c","#4cc9f0","#f72585"][i % 8],
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
          borderLeft: p.shape === "triangle" ? `${p.size/2}px solid transparent` : undefined,
          borderRight: p.shape === "triangle" ? `${p.size/2}px solid transparent` : undefined,
          borderBottom: p.shape === "triangle" ? `${p.size}px solid ${p.color}` : undefined,
          opacity: 0.92,
          animation: `snowfall ${p.duration}s ${p.delay}s linear infinite`,
          "--drift": `${p.drift}px`,
          transform: `rotate(${p.rotate}deg)`,
        }}/>
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

function ItemCard({ item, onUse }) {
  const def = ITEM_DEFS[item.id] || {};
  return (
    <div
      title={def.description}
      onClick={() => onUse(item)}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        padding: "8px 12px",
        background: "white",
        border: "1px solid var(--line)",
        borderRadius: 12,
        cursor: "pointer",
        minWidth: 72,
        boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
        transition: "transform 120ms, box-shadow 120ms",
        userSelect: "none",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.12)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.07)"; }}
    >
      <span style={{ fontSize: 22 }}>{def.icon || "?"}</span>
      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", textAlign: "center" }}>
        {def.name || item.id}
      </span>
    </div>
  );
}

function ItemBar({ items, onUse, isMultiplayer }) {
  if (!isMultiplayer || items.length === 0) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      zIndex: 90,
      display: "flex", alignItems: "center", gap: 8,
      padding: "10px 16px",
      background: "rgba(246,244,239,0.92)",
      backdropFilter: "blur(20px)",
      border: "1px solid var(--line)",
      borderRadius: 18,
      boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
    }}>
      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", marginRight: 4 }}>
        Items
      </span>
      {items.map(item => (
        <ItemCard key={item.instance_id} item={item} onUse={onUse} />
      ))}
    </div>
  );
}

function ItemTargetModal({ item, players, myName, onConfirm, onClose }) {
  const def = ITEM_DEFS[item.id] || {};
  const [selected, setSelected] = React.useState(null);
  const targets = players.filter(p => !p.you && p.name !== myName);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.35)",
      backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "white", borderRadius: 20,
        padding: "28px 32px",
        minWidth: 320, maxWidth: 400,
        boxShadow: "0 16px 48px rgba(0,0,0,0.18)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 32 }}>{def.icon}</span>
          <div>
            <div style={{ fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 16 }}>{def.name}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{def.description}</div>
          </div>
        </div>

        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
          Choisir une cible
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {targets.length === 0 && (
            <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "12px 0" }}>Aucun autre joueur disponible</div>
          )}
          {targets.map(p => (
            <div
              key={p.id}
              onClick={() => setSelected(p.name)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", borderRadius: 10,
                border: selected === p.name ? "2px solid var(--accent)" : "1px solid var(--line)",
                background: selected === p.name ? "var(--accent-soft)" : "white",
                cursor: "pointer",
                transition: "all 120ms",
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: p.color || "#7a9460", flexShrink: 0 }}/>
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 14, fontWeight: 500 }}>{p.name}</span>
              <span style={{ marginLeft: "auto", fontFamily: "'Geist Mono', monospace", fontSize: 12, color: "var(--muted)" }}>{p.score ?? 0} pts</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid var(--line)",
              background: "white", cursor: "pointer", fontFamily: "'Geist', sans-serif", fontSize: 13,
            }}
          >Annuler</button>
          <button
            disabled={!selected}
            onClick={() => selected && onConfirm(selected)}
            style={{
              flex: 2, padding: "10px 0", borderRadius: 10, border: "none",
              background: selected ? "var(--accent)" : "var(--line)",
              color: selected ? "white" : "var(--muted)",
              cursor: selected ? "pointer" : "default",
              fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 600,
              transition: "background 120ms",
            }}
          >Utiliser sur {selected || "..."}</button>
        </div>
      </div>
    </div>
  );
}

function ItemNotification({ effects }) {
  if (effects.length === 0) return null;
  return (
    <div style={{
      position: "fixed", top: 80, right: 24, zIndex: 300,
      display: "flex", flexDirection: "column", gap: 8,
      pointerEvents: "none",
    }}>
      {effects.map(e => (
        <div key={e.id} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px",
          background: "rgba(39,39,42,0.92)",
          color: "white",
          borderRadius: 12,
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          animation: "slide-in-right 0.2s ease-out",
          fontFamily: "'Geist', sans-serif",
          fontSize: 13,
        }}>
          <span style={{ fontSize: 18 }}>{e.icon}</span>
          <span><strong>{e.from}</strong> vous a lancé <strong>{e.name}</strong></span>
        </div>
      ))}
    </div>
  );
}

// ============ Main app ============

function App() {
  const [gameState, setGameState] = useState("lobby");
  const [sessionData, setSessionData] = useState(null);

  const startSession = (data, timeLimit) => {
    // Transform backend data to mock data format expected by the frontend
    const newBody = data.paragraphs.map((p, idx) => {
      // Find if this paragraph is a fake
      const isFake = data.positions.find(pos => pos.paragraph_index === idx + 1);
      
      if (isFake) {
        return [
          { kind: "token", id: "p" + idx, text: p, fake: { id: "F" + idx, truth: isFake.explanation || "A identifier", hint: isFake.hint || "Vérifiez cette information" } }
        ];
      } else {
        return [
          { kind: "token", id: "p" + idx, text: p, fake: null }
        ];
      }
    });

    
    window.WIKIFAKE_ARTICLE = { title: data.topic, subtitle: "Wikipedia" };
    // Create generic infobox from Wikipedia URL or topic
    window.WIKIFAKE_INFOBOX = [
      { label: "DESIGNATION", value: data.topic },
      { label: "SOURCE", value: data.wikipedia_url || "Wikipedia" },
      { label: "FAKES INJECTED", value: data.total_fakes.toString() },
      { label: "STATUS", value: "LIVE", live: true }
    ];
    window.WIKIFAKE_BODY = [{ kind: "lead", paragraphs: newBody }];

    window.WIKIFAKE_FAKES = data.positions.map((pos, i) => ({
      id: "F" + (pos.paragraph_index - 1),
      tokenId: "p" + (pos.paragraph_index - 1),
      text: pos.false_statement,
      level: 1,
      truth: pos.explanation,
      hint: pos.hint
    }));
    
    setSessionData({ ...data, timeLimit: timeLimit || GAME_DURATION });
    setGameState("playing");
  };

  const startMultiplayerSession = (data, socket, username, roomCode, isHost) => {
    startSession(data);
    setSessionData(prev => ({
      ...prev,
      multiplayer: { socket, username, roomCode, isHost }
    }));
  };

  if (gameState === "lobby") {
    return <window.Lobby onStart={startSession} onMultiplayerStart={startMultiplayerSession} />;
  }

  // Restore the original inner App as InnerApp
  return <InnerApp sessionData={sessionData} resetSession={() => setGameState("lobby")} />;
}

function InnerApp({ sessionData, resetSession }) {

  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffect(() => {
    if (sessionData) {
      setTweak({ ...t, gameState: "playing" });
      // Set time limit from session data
      if (sessionData.timeLimit) {
        setTime(sessionData.timeLimit);
      }
    }
  }, [sessionData]);

  const [marked, setMarked] = useState({});
  const [edited, setEdited] = useState({});
  const [hintUnlocks, setHintUnlocks] = useState({});
  const [time, setTime] = useState(180);
  const [timeFrozen, setTimeFrozen] = useState(false);
  const [revealAll, setRevealAll] = useState(false);

  // Item system
  const [items, setItems] = useState([]);
  const [itemModal, setItemModal] = useState(null); // { instance_id, item_id }
  const [activeEffects, setActiveEffects] = useState([]); // [{id, icon, name, from, expiresAt}]
  const [blurActive, setBlurActive] = useState(false);
  const [hintLocked, setHintLocked] = useState(false);
  const [scoreStolen, setScoreStolen] = useState(0);
  const [lightningActive, setLightningActive] = useState(false);
  const [earthquakeActive, setEarthquakeActive] = useState(false);
  const [blackoutActive, setBlackoutActive] = useState(false);
  const [rickrollActive, setRickrollActive] = useState(false);
  const [mirrorActive, setMirrorActive] = useState(false);
  const [tinyActive, setTinyActive] = useState(false);
  const [spinActive, setSpinActive] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const [invertActive, setInvertActive] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [intelOpen, setIntelOpen] = useState(false);
  const [scannerTrigger, setScannerTrigger] = useState(0);
  const [scannedParagraphs, setScannedParagraphs] = useState(new Set());
  const articleRef = useRef(null);

  // Apply accent color via CSS vars
  useEffect(() => {
    const a = ACCENTS[t.accent] || ACCENTS.teal;
    document.documentElement.style.setProperty("--accent", a.primary);
    document.documentElement.style.setProperty("--accent-soft", a.soft);
    document.documentElement.style.setProperty("--accent-line", a.line);
  }, [t.accent]);

  const playing = t.gameState === "playing" && !revealAll;
  const totalFakes = window.WIKIFAKE_FAKES.length;

  // Timer — décrémente chaque seconde (jamais bloqué)
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setTime(x => Math.max(0, x - 1)), 1000);
    return () => clearInterval(id);
  }, [playing]);

  // Auto-submit / game over quand time atteint 0
  useEffect(() => {
    if (time === 0 && playing && !revealAll) {
      onSubmit();
    }
  }, [time, playing, revealAll]);

  // Multiplayer State
  const [leaderboard, setLeaderboard] = useState(null);
  const [waitingForOthers, setWaitingForOthers] = useState(false);
  const [liveScores, setLiveScores] = useState({});
  const [cursors, setCursors] = useState({});

  useEffect(() => {
    if (sessionData && sessionData.multiplayer) {
      const socket = sessionData.multiplayer.socket;

      const handleMessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "game_end") {
          setWaitingForOthers(false);
          setLeaderboard(msg.leaderboard);
          setRevealAll(true);
          setTimeout(() => setTweak("gameState", "results"), 600);
        } else if (msg.type === "live_score_update") {
          setLiveScores(prev => ({ ...prev, [msg.player]: msg.score }));
        } else if (msg.type === "cursor_update") {
          setCursors(prev => ({ ...prev, [msg.player]: { x: msg.x, y: msg.y } }));
        } else if (msg.type === "items_distributed") {
          const me = sessionData.multiplayer.username;
          const myItem = msg.items[me];
          if (myItem) {
            setItems(prev => [...prev, myItem]);
          }
        } else if (msg.type === "item_effect") {
          const effectId = Date.now() + Math.random();
          const def = ITEM_DEFS[msg.item_id] || {};
          setActiveEffects(prev => [...prev, {
            id: effectId,
            icon: msg.item_icon || def.icon,
            name: msg.item_name || def.name,
            from: msg.from,
          }]);
          setTimeout(() => setActiveEffects(prev => prev.filter(e => e.id !== effectId)), 4000);

          if (msg.item_id === "BLUR") {
            setBlurActive(true);
            setTimeout(() => setBlurActive(false), 5000);
          } else if (msg.item_id === "FREEZE_TIME") {
            setTime(prev => Math.max(0, prev - 10));
            setTimeFrozen(true);
            setTimeout(() => setTimeFrozen(false), 3000); // visuel 3s seulement
          } else if (msg.item_id === "HINT_LOCK") {
            setHintLocked(true);
            setTimeout(() => setHintLocked(false), 20000);
          } else if (msg.item_id === "SCORE_STEAL") {
            setScoreStolen(prev => prev + 50);
            setLightningActive(true);
            setTimeout(() => setLightningActive(false), 3000);
          } else if (msg.item_id === "BLACKOUT") {
            setBlackoutActive(true);
            setTimeout(() => setBlackoutActive(false), 5000);
          } else if (msg.item_id === "EARTHQUAKE") {
            setEarthquakeActive(true);
            setTimeout(() => setEarthquakeActive(false), 5000);
          } else if (msg.item_id === "RICKROLL") {
            setRickrollActive(true);
          } else if (msg.item_id === "SCANNER") {
            setScannerTrigger(prev => prev + 1);
          } else if (msg.item_id === "MIRROR") {
            setMirrorActive(true);
            setTimeout(() => setMirrorActive(false), 6000);
          } else if (msg.item_id === "TINY") {
            setTinyActive(true);
            setTimeout(() => setTinyActive(false), 8000);
          } else if (msg.item_id === "SPIN") {
            setSpinActive(true);
            setTimeout(() => setSpinActive(false), 4000);
          } else if (msg.item_id === "CONFETTI") {
            setConfettiActive(true);
            setTimeout(() => setConfettiActive(false), 6000);
          } else if (msg.item_id === "INVERT") {
            setInvertActive(true);
            setTimeout(() => setInvertActive(false), 5000);
          }
        }
      };

      socket.addEventListener("message", handleMessage);
      return () => socket.removeEventListener("message", handleMessage);
    }
  }, [sessionData]);

  // Scanner logic
  useEffect(() => {
    if (scannerTrigger > 0) {
      const fakeTokenIds = new Set(window.WIKIFAKE_FAKES.map(f => f.tokenId));
      const unfoundFakes = [...fakeTokenIds].filter(id => !marked[id] && !edited[id] && !scannedParagraphs.has(id));
      if (unfoundFakes.length > 0) {
        const randomFake = unfoundFakes[Math.floor(Math.random() * unfoundFakes.length)];
        setScannedParagraphs(prev => new Set([...prev, randomFake]));
      }
    }
  }, [scannerTrigger]);

  // Sync cursor live
  useEffect(() => {
    if (!playing || !sessionData?.multiplayer) return;
    const socket = sessionData.multiplayer.socket;
    let lastTime = 0;
    
    const handleMouseMove = (e) => {
      const now = performance.now();
      if (now - lastTime > 60) {
        lastTime = now;
        socket.send(JSON.stringify({
          type: "cursor",
          x: e.clientX / window.innerWidth,
          y: e.clientY / window.innerHeight
        }));
      }
    };
    
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [playing, sessionData]);
  const restart = (kind) => {
    if (kind === "new") {
      if (typeof resetSession === "function") { resetSession(); }
    } else {
      setTweak({ ...t, gameState: "playing" });
      setRevealAll(true);
    }
  };

  const onTokenClick = (id, fakeId) => {
    if (revealAll) return;
    if (t.mode === "expert") {
      setEdited(prev => {
        if (prev[id] !== undefined && prev[id] !== null) {
          const { [id]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [id]: "" };
      });
      return;
    }
    setMarked(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id]; else next[id] = true;
      return next;
    });
  };

  const onTokenEdit = (id, val) => {
    setEdited(prev => {
      if (val === null) { const { [id]: _, ...rest } = prev; return rest; }
      return { ...prev, [id]: val };
    });
  };

  const onUnlockHint = (fakeId, level) => {
    setHintUnlocks(prev => ({ ...prev, [fakeId]: Math.max(prev[fakeId] || 0, level) }));
  };
  const hintedTokenIds = useMemo(() => {
    const s = new Set();
    for (const f of window.WIKIFAKE_FAKES) {
      if ((hintUnlocks[f.id] || 0) >= 1) s.add(f.tokenId);
    }
    return s;
  }, [hintUnlocks]);
  const hintsUsed = Object.values(hintUnlocks).filter(v => v > 0).length;
  const hintPenalty = Object.values(hintUnlocks).reduce((a, v) => a + (v === 1 ? 50 : v === 2 ? 200 : 0), 0);

  const stats = useMemo(() => {
    const markedTokens = new Set([...Object.keys(marked), ...Object.keys(edited)]);
    let tp = 0, fp = 0;
    const fakeTokenIds = new Set(window.WIKIFAKE_FAKES.map(f => f.tokenId));
    for (const id of markedTokens) {
      if (fakeTokenIds.has(id)) tp++; else fp++;
    }
    const missed = totalFakes - tp;
    const precision = (tp + fp) === 0 ? 0 : tp / (tp + fp);
    const recall = totalFakes === 0 ? 0 : tp / totalFakes;
    const f1 = (precision + recall) === 0 ? 0 : 2 * precision * recall / (precision + recall);
    const baseScore = tp * 150;
    const fpPenalty = fp * 80;
    const timeBonus = Math.max(0, Math.floor(time * 0.5));
    const finalScore = baseScore - fpPenalty - hintPenalty - scoreStolen + timeBonus;
    const elapsed = GAME_DURATION - time;
    return {
      truePositives: tp, falsePositives: fp, missed,
      f1, totalFakes, baseScore, fpPenalty, hintPenalty, timeBonus, finalScore,
      timeStr: `${String(Math.floor(elapsed / 60)).padStart(2,"0")}:${String(elapsed % 60).padStart(2,"0")}`,
      sessionId: t.sessionId,
    };
  }, [marked, edited, time, hintPenalty, totalFakes, t.sessionId]);

  const useItem = useCallback((item) => {
    const def = ITEM_DEFS[item.id] || {};
    if (def.targetCount === 0) {
      if (!sessionData?.multiplayer) return;
      const socket = sessionData.multiplayer.socket;
      socket.send(JSON.stringify({
        type: "use_item",
        instance_id: item.instance_id,
        targets: [sessionData.multiplayer.username],
      }));
      setItems(prev => prev.filter(it => it.instance_id !== item.instance_id));
    } else {
      setItemModal(item);
    }
  }, [sessionData]);

  const confirmUseItem = useCallback((targetName) => {
    if (!itemModal || !sessionData?.multiplayer) return;
    const socket = sessionData.multiplayer.socket;
    socket.send(JSON.stringify({
      type: "use_item",
      instance_id: itemModal.instance_id,
      targets: [targetName],
    }));
    setItems(prev => prev.filter(it => it.instance_id !== itemModal.instance_id));
    setItemModal(null);
  }, [itemModal, sessionData]);

  const onSubmit = () => {
    if (sessionData && sessionData.multiplayer) {
      const socket = sessionData.multiplayer.socket;
      // Convert marked token IDs (e.g. "p0") to paragraph indices (1-based)
      const answers = Object.keys(marked).map(k => parseInt(k.substring(1)) + 1);
      socket.send(JSON.stringify({
        type: "submit_answer",
        answers: answers,
        hintsUsed: hintsUsed,
        hintPenalty: hintPenalty,
        scoreStolen: scoreStolen,
      }));
      setWaitingForOthers(true);
    } else {
      setRevealAll(true);
      setTimeout(() => setTweak("gameState", "results"), 600);
    }
  };

  const onUnsubmit = () => {
    if (sessionData && sessionData.multiplayer) {
      const socket = sessionData.multiplayer.socket;
      socket.send(JSON.stringify({ type: "unsubmit_answer" }));
      setWaitingForOthers(false);
    }
  };

  const youScore = useMemo(() => {
    const markedCount = Object.keys(marked).length + Object.keys(edited).length;
    return markedCount * 150 - hintPenalty;
  }, [marked, edited, hintPenalty]);

  // Sync your score live
  useEffect(() => {
    if (sessionData && sessionData.multiplayer && t.gameState === "playing") {
      sessionData.multiplayer.socket.send(JSON.stringify({
        type: "live_score",
        score: youScore
      }));
    }
  }, [youScore, sessionData, t.gameState]);

  const players = useMemo(() => {
    if (leaderboard) {
      return leaderboard.map(p => ({
        ...p,
        color: p.name === sessionData?.multiplayer?.username ? (ACCENTS[t.accent]?.primary || "#1f574d") : "#7a9460",
        you: p.name === sessionData?.multiplayer?.username
      }));
    }
    if (sessionData?.multiplayer && sessionData?.players) {
      // Build real-time scoreboard during game
      const me = sessionData.multiplayer.username;
      const all = sessionData.players.map(p => {
        const isMe = p === me;
        return {
          id: p,
          name: p,
          color: isMe ? (ACCENTS[t.accent]?.primary || "#1f574d") : "#7a9460",
          score: isMe ? youScore : (liveScores[p] || 0),
          you: isMe
        };
      });
      return all.sort((a, b) => b.score - a.score);
    }
    return [
      { id: "you", name: sessionData?.multiplayer?.username || "You", color: ACCENTS[t.accent]?.primary || "#1f574d", score: youScore, you: true },
    ];
  }, [leaderboard, youScore, t.accent, sessionData, liveScores]);

  const markedCount = Object.keys(marked).length + Object.keys(edited).length;
  const progress = Math.min(100, (markedCount / totalFakes) * 100);

  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      <TopBar
        mode={t.mode}
        marked={markedCount}
        total={totalFakes}
        time={time}
        onSubmit={onSubmit}
        onUnsubmit={onUnsubmit}
        target="Paris"
        progress={progress}
        canSubmit={markedCount > 0 && !waitingForOthers && !revealAll}
        waiting={waitingForOthers}
        onOpenIntel={() => setIntelOpen(true)}
        hintsUsed={hintsUsed}
      />

      {/* Main: article fills viewport */}
      <div style={{
        maxWidth: 920, margin: "26px auto 0",
        padding: "0 28px",
        position: "relative",
        zIndex: 1,
        transition: "padding-right 360ms cubic-bezier(.2,.6,.2,1)",
      }}>
        {/* Article — Wikipedia white card */}
        <div
          ref={articleRef}
          className={[
            earthquakeActive ? "earthquake-active" : "",
            spinActive      ? "spin-active"       : "",
          ].filter(Boolean).join(" ")}
          style={{
            background: "white",
            border: "1px solid var(--line)",
            borderRadius: 18,
            padding: "32px 44px 44px",
            boxShadow: "var(--shadow-md)",
            position: "relative",
            filter: [
              blurActive   ? "blur(6px)"   : "",
              invertActive ? "invert(1) hue-rotate(180deg)" : "",
              mirrorActive ? "" : "",
            ].filter(Boolean).join(" ") || "none",
            transform: mirrorActive ? "scaleX(-1)" : undefined,
            transition: "filter 300ms, transform 300ms",
            userSelect: blurActive ? "none" : "auto",
            pointerEvents: blurActive ? "none" : "auto",
          }}
        >
          <div style={{
            display: "flex", alignItems: "center", gap: 14, marginBottom: 22,
            paddingBottom: 12, borderBottom: "1px solid var(--line)",
          }}>
            <LabelMono>Source · Open Encyclopedia</LabelMono>
            <span style={{ width: 1, height: 12, background: "var(--line)" }}/>
            <LabelMono>Article · Free</LabelMono>
            <span style={{ flex: 1 }}/>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#0645ad", fontWeight: 500 }}>
              <span style={{ fontFamily: "'Spectral', serif", fontStyle: "italic" }}>Read</span>
            </span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Edit</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>View history</span>
          </div>

          <Brief mode={t.mode} />

          <div className={[
            "article-body",
            blackoutActive ? "blackout-active" : "",
            tinyActive     ? "tiny-active"     : "",
          ].filter(Boolean).join(" ")}>
            <h1>{window.WIKIFAKE_ARTICLE.title}</h1>
            <p style={{ fontStyle: "italic", color: "#54595d", fontSize: 14.5, margin: "0 0 22px 0" }}>
              {window.WIKIFAKE_ARTICLE.subtitle}.
            </p>

            <div style={{
              background: "#fafaf7", border: "1px solid #ebe9e2", padding: "10px 14px",
              fontSize: 13, marginBottom: 22, width: "fit-content",
              fontFamily: "'Spectral', serif",
              borderRadius: 8,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Contents <span style={{ color: "#54595d", fontSize: 11, fontWeight: 400 }}>[hide]</span></div>
              <ol style={{ margin: 0, paddingLeft: 20, color: "#0645ad", lineHeight: 1.75 }}>
                <li>Article body</li>
                <li>Details</li>
                <li>More information</li>
                <li>Culture and Landmarks</li>
              </ol>
            </div>

            <ArticleBody
              marked={marked}
              edited={edited}
              mode={t.mode}
              hintedTokenIds={hintedTokenIds}
              scannedParagraphs={scannedParagraphs}
              onTokenClick={onTokenClick}
              onTokenEdit={onTokenEdit}
              revealAll={revealAll}
            />

            {revealAll && (
              <div className="reveal-note">
                <LabelMono style={{ color: "var(--accent)", display: "block", marginBottom: 8 }}>
                  Post-mission dossier · Corrected values
                </LabelMono>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {window.WIKIFAKE_FAKES.map((f, i) => (
                    <div key={f.id} style={{
                      paddingBottom: 10,
                      borderBottom: i < window.WIKIFAKE_FAKES.length - 1 ? "1px dashed var(--line)" : "none",
                      fontFamily: "'Geist', sans-serif", fontSize: 13.5,
                    }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                        <span className="mono" style={{ fontSize: 10, color: "var(--accent)", fontWeight: 600, letterSpacing: "0.1em" }}>
                          #{String(i+1).padStart(2,"0")}
                        </span>
                        <span style={{
                          fontFamily: "'Spectral', serif",
                          fontStyle: "italic",
                          fontSize: 15, color: "var(--ink)",
                        }}>"{f.text}"</span>
                      </div>
                      <div style={{ color: "var(--ink-2)", lineHeight: 1.55, fontSize: 13 }}>{f.truth}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Multiplayer cursors */}
          {t.multiplayer && t.showCursors && playing && Object.entries(cursors).map(([name, cur]) => {
            const playerInfo = players.find(p => p.name === name);
            if (!playerInfo || playerInfo.you) return null;
            return <window.BotCursor key={name} x={cur.x * window.innerWidth} y={cur.y * window.innerHeight} name={name} color={playerInfo.color} />;
          })}
        </div>

        <Footer sessionId={t.sessionId} />
      </div>

      {/* SIDE DRAWER */}
      <SideDrawer open={drawerOpen} onToggle={() => setDrawerOpen(o => !o)}>
        <SubjectCard
          facts={window.WIKIFAKE_INFOBOX}
          fakesTotal={totalFakes}
          fakesMarked={markedCount}
          fakesFound={stats.truePositives}
          revealed={revealAll}
        />
        <MissionCard
          difficulty={t.difficulty}
          mode={t.mode}
          room={t.sessionId}
          total={totalFakes}
        />
        <div style={{
          padding: "12px 14px",
          background: "rgba(255,255,255,0.6)",
          border: "1px solid var(--line)",
          borderRadius: 12,
        }}>
          <DataRow label="Session" value={t.sessionId} />
          <DataRow label="Region" value="EU-WEST-3" />
          <DataRow label="Latency" value={<span style={{ color: "var(--green)" }}>24 ms</span>} />
        </div>
      </SideDrawer>

      {/* FLOATING LEADERBOARD */}
      {t.multiplayer && (
        <FloatingLeaderboard players={players.slice(0, 4)} />
      )}

      {/* VISUAL EFFECTS */}
      <BlizzardEffect active={timeFrozen} />
      <LightningEffect active={lightningActive} />
      <StaticEffect active={hintLocked} />
      <FogEffect active={blurActive} />
      <EarthquakeEffect active={earthquakeActive} />
      <BlackoutEffect active={blackoutActive} />
      <ConfettiEffect active={confettiActive} />

      {/* ITEM BAR */}
      {playing && sessionData?.with_items && (
        <ItemBar
          items={items}
          onUse={useItem}
          isMultiplayer={!!sessionData?.multiplayer}
        />
      )}

      {/* ITEM TARGET MODAL */}
      {itemModal && (
        <ItemTargetModal
          item={itemModal}
          players={players}
          myName={sessionData?.multiplayer?.username}
          onConfirm={confirmUseItem}
          onClose={() => setItemModal(null)}
        />
      )}

      {/* ITEM EFFECT NOTIFICATIONS */}
      <ItemNotification effects={activeEffects} />

      {/* INTEL OVERLAY */}
      <IntelOverlay
        open={intelOpen && !hintLocked}
        onClose={() => setIntelOpen(false)}
        targets={window.WIKIFAKE_FAKES}
        unlocked={hintUnlocks}
        onUnlock={onUnlockHint}
      />
      {hintLocked && intelOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.4)",
        }} onClick={() => setIntelOpen(false)}>
          <div style={{
            background: "white", borderRadius: 16, padding: "28px 36px",
            textAlign: "center", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
            <div style={{ fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Intel verrouillé</div>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Un joueur vous a bloqué l'accès aux hints temporairement.</div>
          </div>
        </div>
      )}

      {/* RICKROLL MODAL */}
      {rickrollActive && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.88)",
          animation: "screen-flash 1.2s ease-in-out infinite",
        }}>
          {/* 3 fake popup windows offset behind */}
          {[{ top: "28%", left: "18%", rot: "-6deg" }, { top: "32%", left: "58%", rot: "5deg" }, { top: "18%", left: "38%", rot: "-3deg" }].map((pos, i) => (
            <div key={i} style={{
              position: "absolute", top: pos.top, left: pos.left,
              background: "#fffbe6", borderRadius: 12, padding: "16px 24px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.35)", width: 220,
              transform: `rotate(${pos.rot})`,
              border: "2px solid rgba(255,180,0,0.5)",
              opacity: 0.7,
            }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>🤡</div>
              <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, fontWeight: 600, color: "#b58f3a" }}>PUBLICITÉ INTRUSIVE #{i+1}</div>
              <div style={{ fontSize: 9, color: "#aaa", marginTop: 4 }}>Cliquez ici pour votre cadeau...</div>
            </div>
          ))}
          {/* Main popup */}
          <div style={{
            position: "relative", zIndex: 10,
            background: "linear-gradient(135deg, #fff 60%, #fff8e1)",
            padding: "40px 44px", borderRadius: 20, textAlign: "center",
            boxShadow: "0 24px 80px rgba(0,0,0,0.6)", maxWidth: 420,
            border: "3px solid rgba(255,160,0,0.6)",
            animation: "shake 0.18s infinite",
          }}>
            <div style={{ fontSize: 72, marginBottom: 12, animation: "shake 0.12s infinite", display: "inline-block" }}>🤡</div>
            <h2 style={{
              fontFamily: "'Geist', sans-serif", margin: "0 0 8px",
              color: "#c0392b", fontSize: 22, letterSpacing: "-0.01em",
            }}>POP-UP SPAM !</h2>
            <p style={{ color: "#555", marginBottom: 8, fontSize: 13, lineHeight: 1.5 }}>
              Félicitations ! Vous avez gagné une interruption gratuite offerte par votre adversaire.
            </p>
            <p style={{ color: "#b58f3a", fontSize: 11, marginBottom: 24, fontFamily: "'Geist Mono', monospace" }}>
              ⚠ NE FERMEZ PAS CETTE FENÊTRE ⚠
            </p>
            <button
              className="btn primary"
              onClick={() => setRickrollActive(false)}
              style={{ fontSize: 15, padding: "11px 28px", background: "#c0392b", borderColor: "#c0392b" }}
            >
              Fermer (si vous pouvez)
            </button>
          </div>
        </div>
      )}

      {/* Results modal */}
      {t.gameState === "results" && (
        <Debrief
          stats={stats}
          onRestart={restart}
          mode={t.mode}
          allPlayers={players.map(p => ({
            id: p.id,
            name: p.name,
            color: p.color,
            you: p.you,
            breakdown: p.breakdown || {
              tp: stats.truePositives,
              fp: stats.falsePositives,
              hintsUsed,
              hintPenalty,
              timeBonus: stats.timeBonus,
            }
          }))}
        />
      )}

      {/* TWEAKS */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Game" />
        <TweakRadio
          label="Mode"
          value={t.mode}
          options={[
            { value: "normal", label: "Normal" },
            { value: "expert", label: "Expert" },
          ]}
          onChange={(v) => setTweak("mode", v)}
        />
        <TweakRadio
          label="Difficulty"
          value={t.difficulty}
          options={[
            { value: "easy", label: "Easy" },
            { value: "medium", label: "Med" },
            { value: "hard", label: "Hard" },
          ]}
          onChange={(v) => setTweak("difficulty", v)}
        />
        <TweakRadio
          label="Screen"
          value={t.gameState}
          options={[
            { value: "playing", label: "Playing" },
            { value: "results", label: "Debrief" },
          ]}
          onChange={(v) => setTweak("gameState", v)}
        />
        <TweakButton label="↻ Reset mission" onClick={() => restart("new")} />

        <TweakSection label="Visual" />
        <TweakSelect
          label="Accent"
          value={t.accent}
          options={[
            { value: "teal", label: "Verifier teal" },
            { value: "navy", label: "Editorial navy" },
            { value: "bronze", label: "Bronze hint" },
            { value: "aubergine", label: "Aubergine" },
            { value: "graphite", label: "Pure graphite" },
          ]}
          onChange={(v) => setTweak("accent", v)}
        />

        <TweakSection label="Multiplayer" />
        <TweakToggle label="Leaderboard" value={t.multiplayer} onChange={(v) => setTweak("multiplayer", v)} />
        <TweakToggle label="Live cursors" value={t.showCursors} onChange={(v) => setTweak("showCursors", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
