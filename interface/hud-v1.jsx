/* WIKIFAKE — HUD components */
/* global React */

const { useState, useEffect, useRef, useMemo } = React;

const HUD_COLORS = {
  bg: "#080c14",
  surface: "#0d1421",
  surfaceAlt: "#111827",
  cyan: "#00d4ff",
  violet: "#7c3aed",
  amber: "#f59e0b",
  red: "#ef4444",
  green: "#10b981",
  text: "#e2e8f0",
  textDim: "#64748b",
  textDimmer: "#475569",
  border: "#1e3a5f",
};

const monoStyle = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  letterSpacing: "0.08em",
};

const labelStyle = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.16em",
  color: HUD_COLORS.textDim,
  fontWeight: 500,
};

// =========== HUD Panel — generic container with corner clip ============
function HUDPanel({ title, children, accent = HUD_COLORS.cyan, variant = "default", icon = "◈", actions, style }) {
  const isWarning = variant === "warning";
  const isViolet = variant === "violet";
  const c = isWarning ? HUD_COLORS.amber : isViolet ? HUD_COLORS.violet : accent;
  return (
    <div style={{
      background: HUD_COLORS.bg,
      border: `1px solid ${c}33`,
      borderTop: `2px solid ${c}`,
      clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))",
      boxShadow: `0 0 24px ${c}11, inset 0 0 60px rgba(0,0,0,0.6)`,
      backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,212,255,0.012) 2px, rgba(0,212,255,0.012) 3px)",
      position: "relative",
      ...style,
    }}>
      <div style={{
        padding: "8px 14px 7px",
        borderBottom: `1px solid ${c}33`,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        background: `linear-gradient(90deg, ${c}11, transparent 60%)`,
      }}>
        <div style={{
          ...labelStyle,
          fontSize: 10,
          color: c,
          textShadow: `0 0 6px ${c}88`,
          display: "flex", alignItems: "center", gap: 8,
          fontWeight: 600,
        }}>
          <span style={{ fontSize: 11 }}>{icon}</span>
          <span>{title}</span>
        </div>
        {actions}
      </div>
      <div style={{ padding: "12px 14px" }}>{children}</div>
    </div>
  );
}

// =========== Data row =============
function DataRow({ label, value, highlight, color, bar }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "5px 0", borderBottom: "1px solid #0d142166",
      gap: 12,
    }}>
      <span style={labelStyle}>{label}</span>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
        color: highlight ? HUD_COLORS.cyan : (color || HUD_COLORS.text),
        textShadow: highlight ? "0 0 6px #00d4ff88" : "none",
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        {bar && (
          <span style={{
            display: "inline-block", width: 36, height: 6,
            background: "#0d1421", border: "1px solid #1e3a5f33", position: "relative",
          }}>
            <span style={{
              display: "block", height: "100%",
              width: `${Math.max(0, Math.min(100, bar))}%`,
              background: color || HUD_COLORS.cyan,
              boxShadow: `0 0 6px ${color || HUD_COLORS.cyan}`,
            }} />
          </span>
        )}
        {value}
      </span>
    </div>
  );
}

// =========== Mode badge ===========
function ModeBadge({ mode }) {
  const expert = mode === "expert";
  return (
    <span style={{
      ...monoStyle,
      fontSize: 10,
      textTransform: "uppercase",
      fontWeight: 700,
      padding: "4px 12px",
      background: expert ? "#1a0d33" : "#0d2b4e",
      color: expert ? "#a78bfa" : HUD_COLORS.cyan,
      border: `1px solid ${expert ? "#7c3aed66" : "#00d4ff66"}`,
      clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)",
      boxShadow: `0 0 10px ${expert ? "#7c3aed44" : "#00d4ff33"}, inset 0 0 12px ${expert ? "#7c3aed22" : "#00d4ff11"}`,
      textShadow: `0 0 6px ${expert ? "#a78bfa" : HUD_COLORS.cyan}aa`,
      letterSpacing: "0.18em",
    }}>
      {expert ? "✎ EXPERT MODE" : "◉ NORMAL MODE"}
    </span>
  );
}

// =========== Segmented progress bar (data-loader style) ===========
function SegmentBar({ value, max = 100, segments = 16, color = HUD_COLORS.cyan }) {
  const filled = Math.round((value / max) * segments);
  return (
    <div style={{ display: "flex", gap: 2, height: 10, alignItems: "stretch" }}>
      {Array.from({ length: segments }).map((_, i) => (
        <span key={i} style={{
          width: 7,
          background: i < filled ? color : "#0d1421",
          boxShadow: i < filled ? `0 0 6px ${color}88` : "none",
          border: i < filled ? "none" : `1px solid ${color}22`,
          clipPath: "polygon(2px 0, 100% 0, calc(100% - 2px) 100%, 0 100%)",
          transition: "background 200ms",
        }} />
      ))}
    </div>
  );
}

// =========== Toolbar — sticky top ===========
function HUDToolbar({ mode, marked, total, time, hintsUsed, hintsPenalty, onSubmit, sessionId, target, progress, canSubmit }) {
  const min = Math.floor(time / 60);
  const sec = time % 60;
  const timerColor = time < 30 ? HUD_COLORS.red : time < 120 ? HUD_COLORS.amber : HUD_COLORS.green;
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 100,
      background: HUD_COLORS.bg,
      borderBottom: `2px solid ${HUD_COLORS.cyan}`,
      boxShadow: `0 0 24px #00d4ff22, 0 4px 30px rgba(0,0,0,0.6)`,
      backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,212,255,0.02) 2px, rgba(0,212,255,0.02) 3px)",
    }}>
      <div style={{
        maxWidth: 1400, margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "auto auto 1fr auto auto auto",
        alignItems: "center",
        gap: 20,
        padding: "10px 24px",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: HUD_COLORS.cyan,
            textShadow: "0 0 8px #00d4ffcc",
            transform: "rotate(0deg)",
            display: "inline-block",
          }}>◈</span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 16,
            fontWeight: 700,
            color: HUD_COLORS.cyan,
            letterSpacing: "0.22em",
            textShadow: "0 0 10px #00d4ff99, 0 0 20px #00d4ff44",
            animation: "flicker 8s infinite",
          }}>WIKIFAKE</span>
          <span style={{
            ...labelStyle,
            fontSize: 8,
            color: HUD_COLORS.textDimmer,
            padding: "2px 6px",
            border: `1px solid ${HUD_COLORS.border}`,
            marginLeft: 4,
          }}>v2.0</span>
        </div>

        {/* Mode */}
        <ModeBadge mode={mode} />

        {/* Target + progress */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, ...labelStyle, color: HUD_COLORS.textDim }}>
            <span style={{ color: HUD_COLORS.textDimmer }}>▸ TARGET</span>
            <span style={{ color: HUD_COLORS.text, fontWeight: 700, letterSpacing: "0.12em" }}>{target}</span>
            <span style={{ color: HUD_COLORS.textDimmer }}>·</span>
            <span style={{ color: HUD_COLORS.cyan, textShadow: "0 0 6px #00d4ff88" }}>SCANNING</span>
          </div>
          <SegmentBar value={progress} max={100} segments={24} />
        </div>

        {/* Timer */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <span style={{ ...labelStyle, fontSize: 9 }}>T-MINUS</span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 22,
            fontWeight: 700,
            color: timerColor,
            textShadow: `0 0 10px ${timerColor}cc`,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.08em",
          }}>{String(min).padStart(2,"0")}:{String(sec).padStart(2,"0")}</span>
        </div>

        {/* Marked count */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <span style={{ ...labelStyle, fontSize: 9 }}>MARKED</span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 18,
            fontWeight: 700,
            color: marked > 0 ? HUD_COLORS.cyan : HUD_COLORS.textDim,
            textShadow: marked > 0 ? "0 0 8px #00d4ffaa" : "none",
            fontVariantNumeric: "tabular-nums",
          }}>◉ {String(marked).padStart(2,"0")}</span>
        </div>

        {/* Submit */}
        <button className="hud-btn primary" onClick={onSubmit} disabled={!canSubmit} style={{
          fontSize: 12, padding: "10px 22px", fontWeight: 700,
          animation: marked > 0 && canSubmit ? "hud-pulse 1.8s ease-in-out infinite" : "none",
        }}>
          SUBMIT ▶
        </button>
      </div>

      {/* Sub-strip with secondary info */}
      <div style={{
        maxWidth: 1400, margin: "0 auto",
        display: "flex", gap: 24, alignItems: "center",
        padding: "6px 24px",
        borderTop: `1px solid ${HUD_COLORS.border}66`,
        ...labelStyle,
        fontSize: 9,
      }}>
        <span>SESSION <span style={{ color: HUD_COLORS.cyan }}>{sessionId}</span></span>
        <span>NODE <span style={{ color: HUD_COLORS.text }}>EU-WEST-3</span></span>
        <span>LATENCY <span style={{ color: HUD_COLORS.green }}>24ms</span></span>
        <span style={{ flex: 1 }}></span>
        <span>HINTS USED <span style={{ color: HUD_COLORS.amber }}>{hintsUsed}</span></span>
        <span>PENALTY <span style={{ color: HUD_COLORS.red }}>-{hintsPenalty}pts</span></span>
        <span style={{ color: HUD_COLORS.green, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            display: "inline-block", width: 6, height: 6, borderRadius: "50%",
            background: HUD_COLORS.green, boxShadow: `0 0 8px ${HUD_COLORS.green}`,
            animation: "blink-alert 1.4s ease-in-out infinite",
          }}></span>
          LINK SECURE
        </span>
      </div>
    </div>
  );
}

// =========== HUD Infobox sidebar ===========
function HUDInfobox({ facts, fakesTotal, fakesFound, fakesMarked }) {
  return (
    <HUDPanel title="SUBJECT ANALYSIS" icon="◈">
      <div style={{ display: "flex", gap: 12, alignItems: "stretch", marginBottom: 12 }}>
        {/* placeholder thumbnail with crosshair */}
        <div style={{
          width: 88, height: 110, flexShrink: 0,
          background: "#0d1421",
          border: `1px solid ${HUD_COLORS.border}`,
          position: "relative",
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,212,255,0.04) 2px, rgba(0,212,255,0.04) 3px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          clipPath: "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)",
        }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: HUD_COLORS.cyan, letterSpacing: "0.15em" }}>SUBJECT</span>
          {/* crosshair */}
          <span style={{ position: "absolute", inset: 6, border: `1px dashed ${HUD_COLORS.cyan}66`, pointerEvents: "none" }}/>
          <span style={{ position: "absolute", top: "50%", left: 0, right: 0, borderTop: `1px solid ${HUD_COLORS.cyan}33` }}/>
          <span style={{ position: "absolute", left: "50%", top: 0, bottom: 0, borderLeft: `1px solid ${HUD_COLORS.cyan}33` }}/>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 2 }}>
          <span style={{ ...labelStyle, color: HUD_COLORS.cyan, fontSize: 9 }}>FILE / 0x2A4F</span>
          <span style={{
            fontFamily: "'Spectral', serif",
            color: HUD_COLORS.text, fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em",
            textShadow: "0 0 6px #00d4ff22",
            lineHeight: 1.1,
          }}>Paris</span>
          <span style={{ ...labelStyle, color: HUD_COLORS.textDim, fontSize: 9, marginTop: 4 }}>
            CITY / EU-FR
          </span>
        </div>
      </div>

      {facts.map((f, i) => (
        <DataRow key={i} label={f.label} value={
          f.live
            ? <span style={{ color: HUD_COLORS.green, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: HUD_COLORS.green, boxShadow: `0 0 6px ${HUD_COLORS.green}`, animation: "blink-alert 1.4s infinite" }} />
                {f.value}
              </span>
            : f.value
        } highlight={f.label === "DESIGNATION"} />
      ))}

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${HUD_COLORS.border}` }}>
        <DataRow label="ANOMALIES" value={`${fakesFound} / ${fakesTotal}`} color={fakesFound === fakesTotal ? HUD_COLORS.green : HUD_COLORS.cyan} />
        <DataRow label="MARKERS" value={fakesMarked} bar={Math.min(100, (fakesMarked/fakesTotal)*100)} color={HUD_COLORS.cyan} />
      </div>
    </HUDPanel>
  );
}

// =========== Game info box ===========
function GameInfoBox({ difficulty, mode, room, total }) {
  return (
    <HUDPanel title="ANOMALY DETECTION" icon="⚠" variant="warning">
      <DataRow label="DIFFICULTY" value={difficulty.toUpperCase()} color={HUD_COLORS.amber} />
      <DataRow label="TARGETS" value={`${total} hidden`} />
      <DataRow label="MODE" value={mode.toUpperCase()} color={mode === "expert" ? "#a78bfa" : HUD_COLORS.cyan} />
      <DataRow label="ROOM" value={room} color={HUD_COLORS.amber} />
      <DataRow label="CLASS" value="UNCLASSIFIED" />
      <div style={{ marginTop: 10, padding: "6px 8px", border: `1px dashed ${HUD_COLORS.amber}44`, background: "#1a150010", ...labelStyle, fontSize: 9, color: HUD_COLORS.amber, lineHeight: 1.5 }}>
        ⚠ Article contains <b style={{ color: "#fbbf24" }}>{total}</b> deliberate falsifications. Mark every suspect token before submission.
      </div>
    </HUDPanel>
  );
}

// =========== Leaderboard ===========
function Leaderboard({ players }) {
  const max = Math.max(...players.map(p => p.score), 1);
  return (
    <HUDPanel title="AGENTS IN FIELD" icon="◈">
      {players.map((p, i) => (
        <div key={p.id} style={{
          display: "grid", gridTemplateColumns: "20px 18px 1fr auto", gap: 8, alignItems: "center",
          padding: "5px 0",
          borderBottom: i < players.length - 1 ? "1px solid #0d142166" : "none",
        }}>
          <span style={{
            ...labelStyle,
            color: i === 0 ? HUD_COLORS.amber : HUD_COLORS.textDim,
            fontSize: 11, fontWeight: 700,
          }}>{i+1}</span>
          <span style={{ fontSize: 14, filter: "saturate(1.5)" }}>{p.avatar}</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
              color: p.you ? HUD_COLORS.cyan : HUD_COLORS.text,
              textShadow: p.you ? "0 0 6px #00d4ff88" : "none",
              fontWeight: p.you ? 700 : 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{p.name}{p.you && " ◂"}</span>
            <div style={{ position: "relative", height: 4, background: "#0d1421" }}>
              <div style={{
                width: `${(p.score/max)*100}%`, height: "100%",
                background: p.you ? HUD_COLORS.cyan : p.color,
                boxShadow: `0 0 6px ${p.you ? HUD_COLORS.cyan : p.color}`,
                transition: "width 600ms",
              }}/>
            </div>
          </div>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13, fontWeight: 700, color: p.you ? HUD_COLORS.cyan : HUD_COLORS.text,
            fontVariantNumeric: "tabular-nums",
            textShadow: p.you ? "0 0 6px #00d4ff88" : "none",
          }}>{p.score}</span>
        </div>
      ))}
    </HUDPanel>
  );
}

// =========== Bot cursor ===========
function BotCursor({ x, y, name, color }) {
  return (
    <div style={{
      position: "absolute", left: x, top: y, zIndex: 50, pointerEvents: "none",
      transition: "left 1.6s cubic-bezier(.4,.2,.2,1), top 1.6s cubic-bezier(.4,.2,.2,1)",
      animation: "cursor-pulse 2.4s ease-in-out infinite",
    }}>
      <svg width="18" height="18" viewBox="0 0 18 18" style={{ filter: `drop-shadow(0 0 4px ${color})` }}>
        <path d="M2 2 L2 13 L5 10 L7.5 16 L9.5 15 L7 9.5 L11 9 Z" fill={color} stroke="#000" strokeWidth="0.5"/>
      </svg>
      <span style={{
        position: "absolute", top: 16, left: 8,
        background: color, color: "#000",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9, fontWeight: 700,
        padding: "2px 6px",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        clipPath: "polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)",
      }}>◉ {name}</span>
    </div>
  );
}

// =========== Hints panel ===========
function HintsPanel({ targets, unlocked, onUnlock, mode }) {
  return (
    <HUDPanel
      title="INTEL REQUEST"
      icon="💡"
      variant="warning"
      actions={
        <div style={{ display: "flex", gap: 14, ...labelStyle, fontSize: 9 }}>
          <span>HINT 1 <span style={{ color: HUD_COLORS.amber }}>-50pt</span></span>
          <span>HINT 2 <span style={{ color: HUD_COLORS.amber }}>-100pt</span></span>
          <span>FULL <span style={{ color: HUD_COLORS.red }}>-200pt</span></span>
        </div>
      }
    >
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 10,
      }}>
        {targets.map((t, i) => {
          const u = unlocked[t.id] || 0;
          return (
            <div key={t.id} style={{
              border: `1px solid ${u > 0 ? "#f59e0b66" : HUD_COLORS.border}`,
              background: u > 0 ? "#1a150010" : "#0d142166",
              padding: "8px 10px",
              clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)",
              boxShadow: u > 0 ? "0 0 10px #f59e0b22" : "none",
              transition: "all 200ms",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ ...labelStyle, fontSize: 9, color: u > 0 ? HUD_COLORS.amber : HUD_COLORS.textDim }}>
                  TARGET #{String(i+1).padStart(2,"0")}
                </span>
                <span style={{ ...labelStyle, fontSize: 9, color: u > 0 ? HUD_COLORS.amber : HUD_COLORS.textDimmer }}>
                  {u === 0 ? "SEALED" : u === 1 ? "PARTIAL" : "REVEALED"}
                </span>
              </div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: u > 0 ? "#fbbf24" : HUD_COLORS.textDimmer,
                minHeight: 28,
                lineHeight: 1.4,
                marginBottom: 8,
                opacity: u > 0 ? 1 : 0.5,
              }}>
                {u === 0 ? "▓▓▓▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓" : u === 1 ? `↪ ${t.hint}` : `✓ ${t.truth.slice(0, 80)}…`}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  className="hud-btn warning"
                  disabled={u >= 1}
                  onClick={() => onUnlock(t.id, 1)}
                  style={{ flex: 1, fontSize: 9, padding: "4px 6px" }}
                >HINT</button>
                <button
                  className="hud-btn danger"
                  disabled={u >= 2}
                  onClick={() => onUnlock(t.id, 2)}
                  style={{ flex: 1, fontSize: 9, padding: "4px 6px" }}
                >REVEAL</button>
              </div>
            </div>
          );
        })}
      </div>
    </HUDPanel>
  );
}

// =========== Instruction banner ===========
function InstructionBanner({ mode }) {
  return (
    <div style={{
      background: "linear-gradient(90deg, #0d142166, transparent 80%)",
      borderLeft: `3px solid ${HUD_COLORS.cyan}`,
      padding: "10px 16px",
      margin: "0 0 18px 0",
      ...monoStyle,
      fontSize: 11,
      color: HUD_COLORS.text,
      letterSpacing: "0.06em",
      display: "flex",
      gap: 14, alignItems: "center",
      boxShadow: "inset 0 0 30px #00d4ff08",
    }}>
      <span style={{ color: HUD_COLORS.cyan, fontSize: 14, textShadow: "0 0 8px #00d4ffcc" }}>◈</span>
      <span style={{ color: HUD_COLORS.cyan, fontWeight: 700, letterSpacing: "0.18em" }}>BRIEFING</span>
      <span style={{ color: HUD_COLORS.textDim }}>│</span>
      <span style={{ flex: 1 }}>
        Source document below has been tampered with. {mode === "expert"
          ? <>In <b style={{ color: "#a78bfa" }}>EXPERT MODE</b>, click any token to edit it directly with the value you believe is correct.</>
          : <>Mark every suspect token by clicking. Hover for crosshair preview.</>
        }
      </span>
      <span style={{ ...labelStyle, color: HUD_COLORS.textDim, fontSize: 9 }}>PRESS ⎵ TO PAUSE SCAN</span>
    </div>
  );
}

// =========== Footer ===========
function HUDFooter({ sessionId, version }) {
  return (
    <div style={{
      background: HUD_COLORS.bg,
      borderTop: `1px solid ${HUD_COLORS.border}`,
      padding: "12px 24px",
      marginTop: 40,
      ...labelStyle,
      fontSize: 9,
      color: HUD_COLORS.textDimmer,
      display: "flex",
      gap: 24,
      alignItems: "center",
      flexWrap: "wrap",
    }}>
      <span style={{ color: HUD_COLORS.cyan, textShadow: "0 0 6px #00d4ff66" }}>◈ WIKIFAKE INTELLIGENCE SYSTEM</span>
      <span>v{version}</span>
      <span>·</span>
      <span>SESSION {sessionId}</span>
      <span>·</span>
      <span>NODE EU-WEST-3</span>
      <span style={{ flex: 1 }}></span>
      <span>CLASSIFIED // INTERNAL USE ONLY</span>
      <span style={{ color: HUD_COLORS.green }}>● LINK ACTIVE</span>
    </div>
  );
}

// =========== Debrief screen (results) ===========
function DebriefScreen({ stats, onRestart, mode }) {
  const [showScore, setShowScore] = useState(0);
  useEffect(() => {
    const target = stats.finalScore;
    const dur = 800;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShowScore(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    const id = setTimeout(() => requestAnimationFrame(tick), 400);
    return () => clearTimeout(id);
  }, [stats.finalScore]);

  const grade = stats.f1 >= 0.95 ? { label: "EXPERT DETECTIVE", color: HUD_COLORS.green, icon: "🏆" }
              : stats.f1 >= 0.75 ? { label: "FIELD AGENT", color: HUD_COLORS.cyan, icon: "◈" }
              : stats.f1 >= 0.50 ? { label: "TRAINEE", color: HUD_COLORS.amber, icon: "△" }
              : { label: "COMPROMISED", color: HUD_COLORS.red, icon: "⚠" };

  const lines = [
    { label: "TARGETS FOUND", value: `${stats.truePositives} / ${stats.totalFakes}`, bar: (stats.truePositives/stats.totalFakes)*100, color: HUD_COLORS.green },
    { label: "FALSE POSITIVES", value: stats.falsePositives, bar: stats.falsePositives === 0 ? 0 : Math.min(100, stats.falsePositives*15), color: stats.falsePositives === 0 ? HUD_COLORS.green : HUD_COLORS.red },
    { label: "MISSED", value: stats.missed, bar: stats.missed === 0 ? 0 : (stats.missed/stats.totalFakes)*100, color: HUD_COLORS.amber },
    { label: "F1 ACCURACY", value: `${Math.round(stats.f1*100)}%`, bar: stats.f1*100, color: HUD_COLORS.cyan },
    { label: "TIME ON TARGET", value: stats.timeStr, color: HUD_COLORS.text },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(8, 12, 20, 0.94)",
      backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
      overflowY: "auto",
    }}>
      {/* scanning line */}
      <div style={{
        position: "absolute", left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${HUD_COLORS.cyan}, transparent)`,
        boxShadow: `0 0 20px ${HUD_COLORS.cyan}`,
        animation: "scan-down 4s linear infinite",
        pointerEvents: "none",
      }}/>

      <div style={{
        width: "min(720px, 100%)",
        background: HUD_COLORS.bg,
        border: `1px solid ${HUD_COLORS.cyan}44`,
        borderTop: `3px solid ${HUD_COLORS.cyan}`,
        clipPath: "polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)",
        boxShadow: "0 0 60px #00d4ff44, inset 0 0 80px rgba(0,0,0,0.6)",
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,212,255,0.02) 2px, rgba(0,212,255,0.02) 3px)",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${HUD_COLORS.cyan}33`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ ...labelStyle, fontSize: 11, color: HUD_COLORS.cyan, textShadow: "0 0 6px #00d4ff88", fontWeight: 700, letterSpacing: "0.2em" }}>
            ◈ MISSION DEBRIEF
          </span>
          <span style={{ ...labelStyle, fontSize: 9, color: HUD_COLORS.textDim }}>
            SESSION {stats.sessionId} · {new Date().toISOString().slice(0,10)}
          </span>
        </div>

        {/* Grade */}
        <div style={{ padding: "28px 24px 16px", textAlign: "center" }}>
          <div style={{ ...labelStyle, fontSize: 10, color: HUD_COLORS.textDim, marginBottom: 12 }}>GRADE ASSIGNED</div>
          <div style={{
            display: "flex", justifyContent: "center", alignItems: "center", gap: 16,
            marginBottom: 8,
          }}>
            <span style={{ fontSize: 32, filter: `drop-shadow(0 0 12px ${grade.color})` }}>{grade.icon}</span>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 28,
              fontWeight: 700,
              color: grade.color,
              textShadow: `0 0 14px ${grade.color}aa, 0 0 28px ${grade.color}55`,
              letterSpacing: "0.16em",
              animation: "flicker 6s infinite",
            }}>
              {grade.label}
            </span>
          </div>
        </div>

        {/* Stats lines */}
        <div style={{ padding: "8px 32px 4px" }}>
          {lines.map((l, i) => (
            <div key={i} style={{
              padding: "10px 0",
              borderBottom: `1px solid ${HUD_COLORS.border}44`,
              display: "grid", gridTemplateColumns: "180px 1fr 80px",
              alignItems: "center",
              gap: 16,
              opacity: 0,
              animation: `stagger-in 320ms ease-out forwards`,
              animationDelay: `${0.9 + i * 0.08}s`,
            }}>
              <span style={labelStyle}>{l.label}</span>
              <div style={{ height: 6, background: "#0d1421", border: `1px solid ${HUD_COLORS.border}55`, position: "relative" }}>
                <div style={{
                  width: `${l.bar || 0}%`, height: "100%",
                  background: l.color,
                  boxShadow: `0 0 6px ${l.color}`,
                  transition: "width 800ms cubic-bezier(.2,.6,.2,1)",
                  animationName: "bar-fill",
                  animationDuration: "800ms",
                  animationDelay: `${1.1 + i * 0.08}s`,
                }}/>
              </div>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 14, fontWeight: 700, color: l.color,
                textShadow: `0 0 6px ${l.color}88`,
                fontVariantNumeric: "tabular-nums",
                textAlign: "right",
              }}>{l.value}</span>
            </div>
          ))}
        </div>

        {/* Score breakdown */}
        <div style={{
          padding: "20px 32px 12px", borderTop: `1px dashed ${HUD_COLORS.border}`,
          marginTop: 8,
          opacity: 0,
          animation: "stagger-in 400ms ease-out forwards",
          animationDelay: "1.6s",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", ...labelStyle, fontSize: 11 }}>
            <span>BASE SCORE</span>
            <span style={{ color: HUD_COLORS.text, fontWeight: 700 }}>+{stats.baseScore}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", ...labelStyle, fontSize: 11 }}>
            <span>FALSE POS PENALTY</span>
            <span style={{ color: HUD_COLORS.red, fontWeight: 700 }}>-{stats.fpPenalty}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", ...labelStyle, fontSize: 11 }}>
            <span>INTEL USED</span>
            <span style={{ color: HUD_COLORS.amber, fontWeight: 700 }}>-{stats.hintPenalty}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", ...labelStyle, fontSize: 11 }}>
            <span>TIME BONUS</span>
            <span style={{ color: HUD_COLORS.green, fontWeight: 700 }}>+{stats.timeBonus}</span>
          </div>
        </div>

        {/* Final score */}
        <div style={{
          padding: "20px 32px 24px",
          marginTop: 6,
          borderTop: `2px solid ${HUD_COLORS.cyan}55`,
          background: "linear-gradient(180deg, #00d4ff08, transparent 80%)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ ...labelStyle, fontSize: 12, color: HUD_COLORS.cyan, textShadow: "0 0 6px #00d4ff88", fontWeight: 700, letterSpacing: "0.18em" }}>
              FINAL SCORE
            </span>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 44, fontWeight: 800, color: HUD_COLORS.cyan,
              textShadow: "0 0 16px #00d4ffaa, 0 0 32px #00d4ff55",
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "0.04em",
              animation: "glow-pulse 2.4s ease-in-out infinite",
            }}>
              {showScore}<span style={{ fontSize: 16, color: HUD_COLORS.textDim, marginLeft: 6, letterSpacing: "0.1em" }}>pts</span>
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: "0 32px 24px", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="hud-btn" onClick={() => onRestart("review")} style={{ fontSize: 10 }}>◐ REVIEW ARTICLE</button>
          <button className="hud-btn primary" onClick={() => onRestart("new")} style={{ fontSize: 11 }}>↻ NEW MISSION</button>
        </div>
      </div>
    </div>
  );
}

// Export to window
Object.assign(window, {
  HUDPanel, DataRow, ModeBadge, SegmentBar,
  HUDToolbar, HUDInfobox, GameInfoBox, Leaderboard,
  BotCursor, HintsPanel, InstructionBanner, HUDFooter, DebriefScreen,
  HUD_COLORS, monoStyle, labelStyle,
});
