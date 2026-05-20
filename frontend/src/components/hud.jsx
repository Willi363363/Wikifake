/* WIKIFAKE — Refined HUD components */
/* global React */
const { useState, useEffect, useRef, useMemo } = React;

/* ============ Atoms ============ */
function LabelMono({ children, color, style }) {
  return (
    <span className="mono" style={{
      fontSize: 10,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      color: color || "var(--muted)",
      fontWeight: 500,
      whiteSpace: "nowrap",
      ...style,
    }}>{children}</span>
  );
}

function PulseDot({ color = "var(--green)", size = 6 }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: size, height: size }}>
      <span style={{
        position: "absolute", inset: 0,
        background: color, borderRadius: "50%",
        animation: "pulse-dot 1.8s ease-in-out infinite",
      }}/>
      <span style={{
        position: "absolute", inset: -3,
        background: color, borderRadius: "50%",
        opacity: 0.18,
        animation: "pulse-dot 1.8s ease-in-out infinite",
        animationDelay: "0.4s",
      }}/>
    </span>
  );
}

function Divider({ vertical, style }) {
  return vertical
    ? <span style={{ width: 1, height: 18, background: "var(--line)", display: "inline-block", ...style }}/>
    : <hr style={{ height: 1, border: 0, background: "var(--line)", margin: "12px 0", ...style }}/>;
}

/* Subtle data row */
function DataRow({ label, value, color, mono = true }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      padding: "8px 0",
      borderBottom: "1px solid var(--line)",
      gap: 16,
    }}>
      <LabelMono style={{ flexShrink: 0 }}>{label}</LabelMono>
      <span style={{
        fontFamily: mono ? "'Geist Mono', monospace" : "'Geist', sans-serif",
        fontSize: 13,
        color: color || "var(--ink)",
        fontWeight: 500,
        fontVariantNumeric: "tabular-nums",
        textAlign: "right",
        whiteSpace: "nowrap",
      }}>{value}</span>
    </div>
  );
}

/* Hairline progress bar */
function HairProgress({ value, max = 100, color = "var(--accent)", height = 3 }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{
      width: "100%", height,
      background: "rgba(24, 24, 27, 0.06)",
      borderRadius: 999, overflow: "hidden",
    }}>
      <div style={{
        height: "100%", width: `${pct}%`,
        background: color,
        borderRadius: 999,
        transition: "width 600ms cubic-bezier(.2,.6,.2,1)",
      }}/>
    </div>
  );
}

/* Progress ring */
function Ring({ value, max = 100, size = 44, stroke = 3, color = "var(--accent)", track = "rgba(24,24,27,0.08)", children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none"
                strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 600ms cubic-bezier(.2,.6,.2,1)" }}/>
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

/* Chip */
function Chip({ children, color = "var(--ink)", bg = "white", border = "var(--line-strong)", style }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px",
      borderRadius: 999,
      background: bg,
      border: `1px solid ${border}`,
      color,
      fontFamily: "'Geist Mono', monospace",
      fontSize: 10,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      fontWeight: 500,
      ...style,
    }}>{children}</span>
  );
}

/* ============ Top Bar ============ */
function TopBar({ mode, marked, total, time, onSubmit, onUnsubmit, target, progress, canSubmit, waiting, onOpenIntel, hintsUsed, round, maxRounds }) {
  const min = Math.floor(time / 60);
  const sec = time % 60;
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 80,
      background: "rgba(246, 244, 239, 0.82)",
      backdropFilter: "blur(24px) saturate(180%)",
      WebkitBackdropFilter: "blur(24px) saturate(180%)",
      borderBottom: "1px solid var(--line)",
    }}>
      <div style={{
        maxWidth: 1320, margin: "0 auto",
        padding: "16px 28px",
        display: "grid",
        gridTemplateColumns: "auto auto 1fr auto auto auto auto",
        alignItems: "center",
        gap: 24,
      }}>
        {/* Big logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44,
            borderRadius: 12,
            background: "linear-gradient(135deg, var(--accent), #2a7568)",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
            boxShadow: "0 4px 12px rgba(31, 87, 77, 0.22), inset 0 1px 0 rgba(255,255,255,0.18)",
          }}>
            <img src="/public/image.png" style={{
              width: "100%", height: "100%",
              objectFit: "cover",
              borderRadius: 12,
            }} alt="Wikifake logo" />
          </div>
          <span style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: 30,
            fontWeight: 400,
            letterSpacing: "-0.012em",
            color: "var(--ink)",
            lineHeight: 1,
          }}>Wikifake</span>
        </div>

        {/* Target chip */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Chip color="var(--accent)" bg="var(--accent-soft)" border="var(--accent-line)">
            <PulseDot color="var(--accent)" size={5} />
            {mode === "expert" ? "Expert" : "Normal"}
          </Chip>
          {round && maxRounds && (
            <Chip color="var(--ink)" bg="white" border="var(--line-strong)">
              Round {round}/{maxRounds}
            </Chip>
          )}
        </div>

        <span />

        {/* Intel button */}
        <button className="btn ghost" onClick={onOpenIntel} style={{ position: "relative", padding: "7px 14px" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1.5v1m4.2 1.6l-.7.7M12.5 8h-1m-1.5 3.4l-.7-.7M4.4 11.8l.7-.7M2.5 8h-1m1.7-3.9l.7.7M3.5 7.5a3.5 3.5 0 117 0c0 1.1-.6 2-1.5 2.5v.7H5v-.7A3.5 3.5 0 013.5 7.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Intel
          {hintsUsed > 0 && (
            <span style={{
              position: "absolute", top: -4, right: -4,
              minWidth: 16, height: 16, padding: "0 4px",
              borderRadius: 999,
              background: "var(--bronze)", color: "white",
              fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>{hintsUsed}</span>
          )}
        </button>

        {/* Timer */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0, minWidth: 56 }}>
          <LabelMono style={{ fontSize: 9 }}>Time</LabelMono>
          <span style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 18, fontWeight: 500,
            color: time < 30 ? "var(--danger)" : time < 90 ? "var(--warn)" : "var(--ink)",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.02em",
          }}>{String(Math.floor(time / 60)).padStart(2,"0")}:{String(time % 60).padStart(2,"0")}</span>
        </div>

        {/* Marked count */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Ring value={marked} max={total} size={36} stroke={2.5}>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 600, color: "var(--ink)" }}>
              {marked}
            </span>
          </Ring>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
            <LabelMono>Marked</LabelMono>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>of {total}</span>
          </div>
        </div>

        {/* Submit */}
        {waiting ? (
          <button className="btn ghost" onClick={onUnsubmit} style={{ color: "var(--danger)", borderColor: "var(--danger-soft)", padding: "9px 20px" }}>
            Annuler
          </button>
        ) : (
          <button className="btn primary" onClick={onSubmit} disabled={!canSubmit}>
            Submit
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M3 6.5h7M6.5 3l3.5 3.5L6.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/* ============ Subject card (right sidebar) ============ */
function SubjectCard({ facts, fakesTotal, fakesMarked, fakesFound, revealed }) {
  return (
    <div className="glass" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{
        padding: "18px 20px 16px",
        borderBottom: "1px solid var(--line)",
        display: "flex", gap: 14, alignItems: "flex-start",
      }}>
        <div style={{
          width: 56, height: 70, flexShrink: 0,
          borderRadius: 8,
          background: "linear-gradient(135deg, #ede9df, #d9d5c8)",
          border: "1px solid var(--line)",
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}>
          <span style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: 24, color: "var(--muted)", fontStyle: "italic",
          }}>{(facts?.[0]?.value || "W").charAt(0).toUpperCase()}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <LabelMono>Subject</LabelMono>
          <h3 style={{
            margin: "4px 0 6px",
            fontFamily: "'Instrument Serif', serif",
            fontSize: 26, fontWeight: 400, letterSpacing: "-0.012em",
            lineHeight: 1.05,
            color: "var(--ink)",
          }}>{facts?.[0]?.value || "Sujet"}</h3>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Chip color="var(--muted)" bg="white">Wiki</Chip>
            <Chip color="var(--muted)" bg="white">Article</Chip>
          </div>
        </div>
      </div>
      <div style={{ padding: "8px 20px 20px" }}>
        {facts.map((f, i) => (
          <DataRow key={i} label={f.label} value={
            f.live ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--green)" }}>
                <PulseDot color="var(--green)" size={5} />{f.value}
              </span>
            ) : f.value
          } />
        ))}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <LabelMono>Confirmed</LabelMono>
            <span className="mono" style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              {revealed ? fakesFound : "—"} / {fakesTotal}
            </span>
          </div>
          <HairProgress value={revealed ? fakesFound : fakesMarked} max={fakesTotal} color={revealed ? "var(--green)" : "var(--accent)"} />
        </div>
      </div>
    </div>
  );
}

/* ============ Mission card ============ */
function MissionCard({ difficulty, mode, room, total }) {
  return (
    <div className="glass" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <LabelMono>Mission</LabelMono>
        <Chip color="var(--bronze)" bg="var(--bronze-soft)" border="rgba(140,109,54,0.25)">Active</Chip>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
        <div>
          <LabelMono style={{ fontSize: 9 }}>Difficulty</LabelMono>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: "var(--ink)", lineHeight: 1.1, marginTop: 2, textTransform: "capitalize" }}>{difficulty}</div>
        </div>
        <div>
          <LabelMono style={{ fontSize: 9 }}>Targets</LabelMono>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: "var(--ink)", lineHeight: 1.1, marginTop: 2 }}>{total}<span style={{ fontSize: 14, color: "var(--muted)", marginLeft: 4 }}>hidden</span></div>
        </div>
      </div>
      <div style={{
        padding: "10px 12px",
        background: "rgba(31, 87, 77, 0.04)",
        border: "1px solid rgba(31, 87, 77, 0.10)",
        borderRadius: 10,
        fontSize: 12, lineHeight: 1.5,
        color: "var(--ink-2)",
        display: "flex", gap: 10, alignItems: "flex-start",
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginTop: 2, flexShrink: 0 }}>
          <circle cx="7" cy="7" r="5.5" stroke="var(--accent)" strokeWidth="1.2"/>
          <path d="M7 4v3.5M7 9.5v.1" stroke="var(--accent)" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <span>This article contains <b style={{ color: "var(--accent)", fontWeight: 600 }}>{total} deliberate falsifications</b>. Click any word to mark it as suspect.</span>
      </div>
    </div>
  );
}

/* ============ Leaderboard ============ */
function Leaderboard({ players }) {
  const max = Math.max(...players.map(p => p.score), 1);
  return (
    <div className="glass" style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <LabelMono>Live ranking</LabelMono>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <PulseDot color="var(--accent)" size={5}/>
          <LabelMono style={{ fontSize: 9 }}>{players.length} agents</LabelMono>
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {players.map((p, i) => (
          <div key={p.id} style={{
            display: "grid", gridTemplateColumns: "20px 28px 1fr auto", gap: 10, alignItems: "center",
          }}>
            <span className="mono" style={{ fontSize: 11, color: i === 0 ? "var(--bronze)" : "var(--muted)", fontWeight: 600 }}>
              {String(i+1).padStart(2,"0")}
            </span>
            <span style={{
              width: 24, height: 24, borderRadius: "50%",
              background: p.color, color: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Geist Mono', monospace", fontSize: 10, fontWeight: 700,
              border: p.you ? "2px solid var(--ink)" : "none",
            }}>
              {p.name[0]}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
              <span style={{
                fontSize: 12, fontWeight: p.you ? 600 : 500,
                color: "var(--ink)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{p.name}{p.you && <span style={{ color: "var(--muted)", marginLeft: 4 }}>· you</span>}</span>
              <HairProgress value={(p.score/max)*100} color={p.you ? "var(--accent)" : p.color} height={2}/>
            </div>
            <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
              {p.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ Bot cursor ============ */
function BotCursor({ x, y, name, color }) {
  return (
    <div style={{
      position: "fixed", left: x, top: y, zIndex: 500, pointerEvents: "none",
      transition: "left 1.6s cubic-bezier(.4,.2,.2,1), top 1.6s cubic-bezier(.4,.2,.2,1)",
    }}>
      <svg width="16" height="16" viewBox="0 0 16 16" style={{ filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.15))` }}>
        <path d="M2 2 L2 12 L5 9 L7 14 L9 13 L7 8.5 L11 8.5 Z" fill={color} stroke="white" strokeWidth="1" strokeLinejoin="round"/>
      </svg>
      <span style={{
        position: "absolute", top: 14, left: 10,
        background: color, color: "white",
        fontFamily: "'Geist Mono', monospace",
        fontSize: 9.5, fontWeight: 600,
        padding: "2px 8px",
        letterSpacing: "0.08em",
        whiteSpace: "nowrap",
        borderRadius: 999,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      }}>{name}</span>
    </div>
  );
}

/* ============ Hints panel ============ */
function HintsPanel({ targets, unlocked, onUnlock }) {
  return (
    <div className="glass" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 24, height: 24, borderRadius: 8,
            background: "var(--bronze-soft)", color: "var(--bronze)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1.5v1m4 1.5l-.7.7m1.7 3.8h-1m-1.5 3.4l-.7-.7M4.4 11.8l.7-.7M2.5 7.5h-1m1.7-3.8l.7.7M3.5 7.5a3 3 0 016 0c0 1-.5 1.8-1.2 2.3v.7H4.7v-.7A2.9 2.9 0 013.5 7.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </span>
          <div>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 18, color: "var(--ink)", letterSpacing: "-0.005em", lineHeight: 1.1 }}>Intel</div>
            <LabelMono style={{ fontSize: 9 }}>Request hints — costs points</LabelMono>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <Chip color="var(--bronze)" bg="white" border="rgba(140,109,54,0.20)">Hint −50</Chip>
          <Chip color="var(--danger)" bg="white" border="rgba(166,75,72,0.20)">Reveal −200</Chip>
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 10,
      }}>
        {targets.map((t, i) => {
          const u = unlocked[t.id] || 0;
          return (
            <div key={t.id} style={{
              border: `1px solid ${u > 0 ? "rgba(140,109,54,0.25)" : "var(--line)"}`,
              background: u > 0 ? "var(--bronze-soft)" : "rgba(255,255,255,0.5)",
              padding: "10px 12px",
              borderRadius: 12,
              transition: "all 240ms",
              minHeight: 92,
              display: "flex", flexDirection: "column",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <LabelMono style={{ fontSize: 9, color: u > 0 ? "var(--bronze)" : "var(--muted)" }}>
                  #{String(i+1).padStart(2,"0")}
                </LabelMono>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: u === 2 ? "var(--danger)" : u === 1 ? "var(--bronze)" : "var(--line-strong)",
                }}/>
              </div>
              <div style={{
                fontSize: 12, color: u > 0 ? "var(--ink-2)" : "var(--muted-2)",
                lineHeight: 1.4,
                flex: 1, marginBottom: 8,
                fontFamily: u === 0 ? "'Geist Mono', monospace" : "'Geist', sans-serif",
                letterSpacing: u === 0 ? "0.05em" : "0",
              }}>
                {u === 0 && "▒▒▒▒▒ ▒▒▒▒▒▒ ▒▒▒ ▒▒▒"}
                {u === 1 && t.hint}
                {u === 2 && t.truth.slice(0, 80) + "…"}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  className="btn ghost"
                  disabled={u >= 1}
                  onClick={() => onUnlock(t.id, 1)}
                  style={{ flex: 1, fontSize: 11, padding: "4px 8px" }}
                >Hint</button>
                <button
                  className="btn ghost"
                  disabled={u >= 2}
                  onClick={() => onUnlock(t.id, 2)}
                  style={{ flex: 1, fontSize: 11, padding: "4px 8px", color: u >= 2 ? "" : "var(--danger)" }}
                >Reveal</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============ Instruction banner ============ */
function Brief({ mode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "12px 18px",
      background: "linear-gradient(90deg, var(--accent-soft), rgba(232, 240, 237, 0.4))",
      border: "1px solid var(--accent-line)",
      borderRadius: 12,
      marginBottom: 22,
    }}>
      <span style={{
        width: 28, height: 28, flexShrink: 0,
        borderRadius: "50%",
        background: "var(--accent)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "white",
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1l1.5 4.5L13 7l-4.5 1.5L7 13l-1.5-4.5L1 7l4.5-1.5L7 1z" fill="currentColor"/>
        </svg>
      </span>
      <div style={{ flex: 1 }}>
        <LabelMono style={{ color: "var(--accent)", fontSize: 9 }}>Briefing</LabelMono>
        <div style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.5, marginTop: 2 }}>
          {mode === "expert"
            ? <>Source document below has been tampered with. In <b>Expert mode</b>, click any token and type the value you believe is correct.</>
            : <>Source document below has been tampered with. Mark every suspect word by clicking — hover for a crosshair preview.</>}
        </div>
      </div>
      <Chip color="var(--accent)" bg="white" border="var(--accent-line)">Press ⎵ to pause</Chip>
    </div>
  );
}

/* ============ Footer ============ */
function Footer({ sessionId }) {
  return (
    <div style={{
      maxWidth: 1320, margin: "60px auto 0",
      padding: "20px 28px 30px",
      display: "flex", gap: 20, alignItems: "center",
      borderTop: "1px solid var(--line)",
      flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 18, height: 18,
          borderRadius: 5,
          background: "linear-gradient(135deg, var(--accent), #2a7568)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white",
          fontFamily: "'Instrument Serif', serif",
          fontSize: 12, fontStyle: "italic",
        }}>W</div>
        <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 15, color: "var(--ink)" }}>Wikifake</span>
      </div>
      <LabelMono>Intelligence System · v2.0.1</LabelMono>
      <LabelMono>Session {sessionId}</LabelMono>
      <span style={{ flex: 1 }}/>
      <LabelMono>© 2026 · An exercise in disinformation literacy</LabelMono>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <PulseDot color="var(--green)" size={5}/>
        <LabelMono style={{ fontSize: 9 }}>Active</LabelMono>
      </span>
    </div>
  );
}

/* ============ Animated final ranking ============ */
const STAGE_LABELS = [
  { label: "Tallying corrections", note: "Base score per anomaly found" },
  { label: "Applying penalties", note: "False-positive marks deducted" },
  { label: "Counting intel used", note: "Hint requests deducted" },
  { label: "Awarding time bonus", note: "Speed of completion" },
  { label: "Final ranking", note: "Mission complete" },
];

function AnimatedRanking({ players }) {
  const [stage, setStage] = useState(0);
  const [displayed, setDisplayed] = useState({});
  const [stageProgress, setStageProgress] = useState(0);

  // Sequence stage transitions
  useEffect(() => {
    const schedule = [800, 1300, 1100, 1000, 900]; // start delay + per-stage
    const timers = [];
    let total = 0;
    schedule.forEach((delay, i) => {
      total += delay;
      timers.push(setTimeout(() => setStage(i + 1), total));
    });
    return () => timers.forEach(clearTimeout);
  }, [players.length]);

  // Score at stage
  const scoreAtStage = (b, s) => {
    let score = 0;
    if (s >= 1) score += b.tp * 150;
    if (s >= 2) score -= b.fp * 80;
    if (s >= 3) score -= (b.hintPenalty || 0);
    if (s >= 4) score += b.timeBonus || 0;
    return score;
  };

  // Animate displayed scores when stage changes
  useEffect(() => {
    const startTime = performance.now();
    const startScores = {};
    const targetScores = {};
    players.forEach(p => {
      startScores[p.id] = displayed[p.id] || 0;
      targetScores[p.id] = scoreAtStage(p.breakdown, stage);
    });

    const dur = stage === 0 ? 0 : 900;
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setStageProgress(eased);
      const next = {};
      players.forEach(p => {
        next[p.id] = Math.round(startScores[p.id] + (targetScores[p.id] - startScores[p.id]) * eased);
      });
      setDisplayed(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage]);

  // Compute current ranks
  const ranked = [...players].sort((a, b) => (displayed[b.id] || 0) - (displayed[a.id] || 0));
  const rankIndex = {};
  ranked.forEach((p, i) => { rankIndex[p.id] = i; });
  const max = Math.max(...players.map(p => displayed[p.id] || 0), 1);

  const ROW_HEIGHT = 60;
  const totalHeight = players.length * ROW_HEIGHT;

  // Per-stage chip for each player (shows delta)
  const stageDelta = (b, s) => {
    if (s === 1) return { value: `+${b.tp * 150}`, color: "var(--green)" };
    if (s === 2) return { value: b.fp > 0 ? `−${b.fp * 80}` : `±0`, color: b.fp > 0 ? "var(--danger)" : "var(--muted)" };
    if (s === 3) return { value: (b.hintPenalty || 0) > 0 ? `−${b.hintPenalty}` : `±0`, color: (b.hintPenalty || 0) > 0 ? "var(--bronze)" : "var(--muted)" };
    if (s === 4) return { value: `+${b.timeBonus || 0}`, color: "var(--green)" };
    return null;
  };

  const phase = STAGE_LABELS[Math.min(stage, STAGE_LABELS.length - 1)];

  return (
    <div style={{ padding: "0 32px 28px" }}>
      {/* Phase header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        padding: "0 0 14px",
        gap: 16,
      }}>
        <div style={{ minWidth: 0 }}>
          <LabelMono>Live ranking</LabelMono>
          <div style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: 22, color: "var(--ink)", lineHeight: 1.1, marginTop: 2,
            transition: "color 280ms",
            whiteSpace: "nowrap",
          }}>
            {phase.label}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "flex-end", marginBottom: 4 }}>
            {STAGE_LABELS.map((_, i) => (
              <span key={i} style={{
                width: i === stage - 1 ? 16 : 6,
                height: 4,
                borderRadius: 2,
                background: i < stage ? "var(--accent)" : "var(--line-strong)",
                transition: "all 320ms cubic-bezier(.2,.6,.2,1)",
              }}/>
            ))}
          </div>
          <span style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>{phase.note}</span>
        </div>
      </div>

      {/* Animated rows */}
      <div style={{
        position: "relative",
        height: totalHeight,
      }}>
        {players.map((p, originalIndex) => {
          const currentRank = rankIndex[p.id];
          const yOffset = currentRank * ROW_HEIGHT;
          const score = displayed[p.id] || 0;
          const delta = stageDelta(p.breakdown, stage);
          const isLeader = currentRank === 0 && stage >= 1;
          return (
            <div key={p.id} style={{
              position: "absolute", top: 0, left: 0, right: 0,
              transform: `translateY(${yOffset}px)`,
              transition: "transform 700ms cubic-bezier(.4,.0,.2,1)",
              height: ROW_HEIGHT - 8,
              padding: "10px 14px",
              display: "grid",
              gridTemplateColumns: "26px 28px 1fr auto auto",
              gap: 14, alignItems: "center",
              background: p.you ? "rgba(31, 87, 77, 0.045)" : "rgba(255, 255, 255, 0.5)",
              border: `1px solid ${isLeader ? "rgba(140, 109, 54, 0.32)" : p.you ? "var(--accent-line)" : "var(--line)"}`,
              borderRadius: 12,
              boxShadow: isLeader ? "0 6px 14px -6px rgba(140, 109, 54, 0.25)" : "none",
            }}>
              {/* Rank */}
              <span style={{
                fontFamily: "'Instrument Serif', serif",
                fontSize: 22, fontStyle: "italic",
                color: isLeader ? "var(--bronze)" : currentRank === 1 ? "var(--muted)" : "var(--muted-2)",
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                textAlign: "center",
                transition: "color 320ms",
              }}>{currentRank + 1}</span>

              {/* Avatar */}
              <span style={{
                width: 26, height: 26, borderRadius: "50%",
                background: p.color, color: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 700,
                border: p.you ? "2px solid var(--ink)" : "none",
                flexShrink: 0,
              }}>{p.name[0]}</span>

              {/* Name + bar */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <span style={{
                  fontSize: 13, fontWeight: p.you ? 600 : 500,
                  color: "var(--ink)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {p.name}
                  {p.you && <span style={{ color: "var(--muted)", marginLeft: 6, fontSize: 11 }}>· you</span>}
                  {isLeader && <span style={{ color: "var(--bronze)", marginLeft: 8, fontSize: 11, fontStyle: "italic", fontFamily: "'Instrument Serif', serif" }}>Leader</span>}
                </span>
                <div style={{ position: "relative", height: 3, background: "rgba(24,24,27,0.06)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${(score / max) * 100}%`,
                    background: p.you ? "var(--accent)" : p.color,
                    borderRadius: 999,
                    transition: "width 600ms cubic-bezier(.2,.6,.2,1), background 200ms",
                    boxShadow: isLeader ? `0 0 8px ${p.color}55` : "none",
                  }}/>
                </div>
              </div>

              {/* Delta chip for current stage */}
              <span style={{
                opacity: delta && stageProgress < 1 ? (1 - stageProgress * 0.4) : 0,
                transform: delta ? `translateY(${(1 - stageProgress) * 4}px)` : "none",
                transition: "opacity 200ms ease, transform 320ms ease",
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11, fontWeight: 600,
                color: delta?.color || "var(--muted)",
                fontVariantNumeric: "tabular-nums",
                minWidth: 40,
                textAlign: "right",
              }}>
                {delta?.value || ""}
              </span>

              {/* Score */}
              <span style={{
                fontFamily: "'Instrument Serif', serif",
                fontSize: 24, fontWeight: 400,
                color: "var(--ink)",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.01em",
                minWidth: 64,
                textAlign: "right",
                lineHeight: 1,
              }}>{score.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============ Debrief / results modal ============ */
function Debrief({ stats, onRestart, mode, allPlayers, onExit }) {
  const [revealStats, setRevealStats] = useState(false);

  // After the ranking finishes (~5.1s), reveal personal stats
  useEffect(() => {
    const id = setTimeout(() => setRevealStats(true), 5400);
    return () => clearTimeout(id);
  }, []);

  const grade = stats.f1 >= 0.95 ? { label: "Outstanding", note: "Expert detective", color: "var(--green)", bg: "var(--green-soft)" }
              : stats.f1 >= 0.75 ? { label: "Strong", note: "Field agent",       color: "var(--accent)", bg: "var(--accent-soft)" }
              : stats.f1 >= 0.50 ? { label: "Promising", note: "Trainee",        color: "var(--bronze)", bg: "var(--bronze-soft)" }
              :                    { label: "Compromised", note: "Recalibrate",  color: "var(--danger)", bg: "var(--danger-soft)" };

  // Get player's final rank
  const playerScore = stats.finalScore;
  const allScores = (allPlayers || []).map(p => {
    if (p.score !== undefined) return p.score;
    if (p.you) return playerScore;
    const b = p.breakdown;
    return b.tp * 150 - b.fp * 80 - (b.hintPenalty || 0) + (b.timeBonus || 0);
  });
  const playerRank = (allPlayers || []).findIndex(p => p.you);
  const playerFinalScore = playerRank >= 0 ? allScores[playerRank] : playerScore;
  const sortedScores = [...allScores].sort((a, b) => b - a);
  const finalRank = sortedScores.indexOf(playerFinalScore) + 1;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(246, 244, 239, 0.78)",
      backdropFilter: "blur(18px) saturate(180%)",
      WebkitBackdropFilter: "blur(18px) saturate(180%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, overflowY: "auto",
      animation: "fade-in 240ms ease-out",
    }}>
      <div style={{
        width: "min(760px, 100%)",
        background: "white",
        border: "1px solid var(--line)",
        borderRadius: 22,
        boxShadow: "0 30px 80px -20px rgba(24,24,27,0.22), 0 10px 30px -10px rgba(24,24,27,0.10)",
        overflow: "hidden",
        margin: "auto",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 28px",
          borderBottom: "1px solid var(--line)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 8,
              background: "linear-gradient(135deg, var(--accent), #2a7568)",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
            }}>
              <img src="/public/image.png" style={{
                width: "100%", height: "100%",
                objectFit: "cover",
                borderRadius: 8,
              }} alt="Wikifake logo" />
            </div>
            <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: "var(--ink)", whiteSpace: "nowrap" }}>Mission debrief</span>
          </div>
          <LabelMono>{stats.sessionId} · {new Date().toISOString().slice(0,10)}</LabelMono>
        </div>

        {/* ANIMATED LIVE RANKING */}
        <div style={{ padding: "24px 0 8px" }}>
          {allPlayers && allPlayers.length > 0 && (
            <AnimatedRanking players={allPlayers} />
          )}
        </div>

        {/* Personal grade reveal */}
        <div style={{
          padding: "20px 32px 12px",
          borderTop: "1px solid var(--line)",
          opacity: revealStats ? 1 : 0,
          transform: revealStats ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 480ms ease, transform 480ms cubic-bezier(.2,.6,.2,1)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div>
              <LabelMono>Your performance</LabelMono>
              <div style={{ display: "flex", flexDirection: "column", marginTop: 6 }}>
                <span style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontSize: 32, fontWeight: 400, fontStyle: "italic",
                  color: grade.color, lineHeight: 1, letterSpacing: "-0.01em",
                  whiteSpace: "nowrap",
                }}>{grade.label}</span>
                <LabelMono style={{ color: grade.color, fontSize: 10, marginTop: 6 }}>{grade.note}</LabelMono>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ textAlign: "right" }}>
                <LabelMono>Final rank</LabelMono>
                <div style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontSize: 28, color: "var(--ink)", fontStyle: "italic",
                  lineHeight: 1, marginTop: 2,
                  fontVariantNumeric: "tabular-nums",
                }}>{finalRank}<span style={{ fontSize: 14, color: "var(--muted)" }}> / {allPlayers?.length || 1}</span></div>
              </div>
              <div style={{ width: 1, height: 36, background: "var(--line)" }}/>
              <div style={{ textAlign: "right" }}>
                <LabelMono>Final score</LabelMono>
                <div style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontSize: 36, color: "var(--ink)",
                  lineHeight: 1, marginTop: 2,
                  letterSpacing: "-0.02em",
                  fontVariantNumeric: "tabular-nums",
                }}>{playerFinalScore.toLocaleString()}<span style={{ fontSize: 14, color: "var(--muted)", marginLeft: 4 }}>pts</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Personal breakdown */}
        <div style={{
          padding: "16px 32px 22px",
          opacity: revealStats ? 1 : 0,
          transform: revealStats ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 480ms ease 120ms, transform 480ms cubic-bezier(.2,.6,.2,1) 120ms",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            {[
              { label: "Found", value: `${stats.truePositives}/${stats.totalFakes}`, color: "var(--green)" },
              { label: "False pos.", value: stats.falsePositives, color: stats.falsePositives === 0 ? "var(--green)" : "var(--danger)" },
              { label: "Hints", value: stats.hintPenalty > 0 ? `−${stats.hintPenalty}` : "0", color: "var(--bronze)" },
              { label: "Time bonus", value: `+${stats.timeBonus}`, color: "var(--green)" },
            ].map((m, i) => (
              <div key={i} style={{
                padding: "10px 12px",
                background: "rgba(255,255,255,0.4)",
                border: "1px solid var(--line)",
                borderRadius: 10,
              }}>
                <LabelMono>{m.label}</LabelMono>
                <div className="mono" style={{
                  fontSize: 16, fontWeight: 600, color: m.color, marginTop: 4,
                  fontVariantNumeric: "tabular-nums",
                }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: "0 32px 28px",
          display: "flex", gap: 10, justifyContent: "flex-end",
          opacity: revealStats ? 1 : 0,
          transition: "opacity 360ms ease 280ms",
        }}>
          <button className="btn ghost" onClick={() => onRestart("review")}>Review article</button>
          {onExit && (
            <button className="btn ghost" onClick={onExit} style={{ color: "var(--danger)" }}>
              Quitter la salle
            </button>
          )}
          <button className="btn primary" onClick={() => onRestart("new")}>
            New mission
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M3 6.5h7M6.5 3l3.5 3.5L6.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ Side Drawer (Subject + Mission) ============ */
function SideDrawer({ open, onToggle, children }) {
  return (
    <>
      {/* Tab handle — always visible on right edge */}
      <button
        onClick={onToggle}
        aria-label={open ? "Close panel" : "Open panel"}
        style={{
          position: "fixed",
          top: "50%",
          right: open ? 360 : 0,
          transform: "translateY(-50%)",
          width: 28, height: 84,
          background: "rgba(255, 255, 255, 0.86)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid var(--line)",
          borderRight: open ? "1px solid var(--line)" : "none",
          borderRadius: open ? "10px 0 0 10px" : "10px 0 0 10px",
          cursor: "pointer",
          zIndex: 70,
          padding: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 4,
          color: "var(--muted)",
          transition: "right 360ms cubic-bezier(.2,.6,.2,1), background 200ms, color 140ms",
          boxShadow: "-4px 0 12px -8px rgba(24,24,27,0.12)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 360ms" }}>
          <path d="M3.5 1.5l3 3.5-3 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 9,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 500,
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
        }}>Brief</span>
      </button>

      {/* Drawer panel */}
      <div style={{
        position: "fixed",
        top: 0, bottom: 0,
        right: open ? 0 : -360,
        width: 360,
        background: "rgba(246, 244, 239, 0.78)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        borderLeft: "1px solid var(--line)",
        boxShadow: open ? "-12px 0 40px -16px rgba(24,24,27,0.18)" : "none",
        zIndex: 60,
        transition: "right 360ms cubic-bezier(.2,.6,.2,1), box-shadow 200ms",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "20px 22px 14px",
          borderBottom: "1px solid var(--line)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          gap: 12,
        }}>
          <div style={{ minWidth: 0 }}>
            <LabelMono style={{ fontSize: 9 }}>Briefing panel</LabelMono>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: "var(--ink)", marginTop: 2, lineHeight: 1.1, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
              Mission overview
            </div>
          </div>
          <button onClick={onToggle} className="btn-icon" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div style={{
          flex: 1, overflowY: "auto",
          padding: "18px 22px 24px",
          display: "flex", flexDirection: "column", gap: 14,
        }}>
          {children}
        </div>
      </div>
    </>
  );
}

/* ============ Floating leaderboard — sticky, expands on hover ============ */
function FloatingLeaderboard({ players }) {
  const [hovered, setHovered] = useState(false);
  const max = Math.max(...players.map(p => p.score), 1);
  const top = players[0];
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "fixed",
        left: 24,
        bottom: 24,
        zIndex: 65,
        width: hovered ? 280 : 200,
        background: hovered ? "rgba(255, 255, 255, 0.86)" : "rgba(255, 255, 255, 0.74)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        boxShadow: hovered
          ? "0 24px 60px -16px rgba(24, 24, 27, 0.28), 0 8px 16px -6px rgba(24, 24, 27, 0.10)"
          : "0 12px 30px -16px rgba(24, 24, 27, 0.18), 0 4px 10px -6px rgba(24, 24, 27, 0.06)",
        overflow: "hidden",
        transition: "width 320ms cubic-bezier(.2,.6,.2,1), background 200ms, box-shadow 240ms",
        cursor: "default",
      }}
    >
      {/* Header strip — always visible */}
      <div style={{
        padding: "11px 14px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        gap: 10,
        borderBottom: hovered ? "1px solid var(--line)" : "1px solid transparent",
        transition: "border-color 200ms",
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <PulseDot color="var(--accent)" size={5}/>
          <LabelMono>Ranking · {players.length}</LabelMono>
        </span>
        {!hovered && top && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{
              width: 18, height: 18, borderRadius: "50%",
              background: top.color, color: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 700,
              border: top.you ? "2px solid var(--ink)" : "none",
            }}>{top.name[0]}</span>
            <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
              {top.score}
            </span>
          </span>
        )}
        {hovered && (
          <span className="mono" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.14em" }}>LIVE</span>
        )}
      </div>

      {/* Expanded list */}
      <div style={{
        maxHeight: hovered ? 320 : 0,
        opacity: hovered ? 1 : 0,
        transition: "max-height 320ms cubic-bezier(.2,.6,.2,1), opacity 180ms ease",
        overflow: "hidden",
      }}>
        <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          {players.map((p, i) => (
            <div key={p.id} style={{
              display: "grid", gridTemplateColumns: "16px 22px 1fr auto", gap: 10, alignItems: "center",
              opacity: hovered ? 1 : 0,
              transform: hovered ? "translateY(0)" : "translateY(-6px)",
              transition: `opacity 280ms ease ${i * 30}ms, transform 280ms cubic-bezier(.2,.6,.2,1) ${i * 30}ms`,
            }}>
              <span className="mono" style={{ fontSize: 11, color: i === 0 ? "var(--bronze)" : "var(--muted)", fontWeight: 600 }}>
                {String(i+1).padStart(2,"0")}
              </span>
              <span style={{
                width: 20, height: 20, borderRadius: "50%",
                background: p.color, color: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Geist Mono', monospace", fontSize: 10, fontWeight: 700,
                border: p.you ? "2px solid var(--ink)" : "none",
              }}>
                {p.name[0]}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <span style={{
                  fontSize: 12, fontWeight: p.you ? 600 : 500,
                  color: "var(--ink)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{p.name}{p.you && <span style={{ color: "var(--muted)", marginLeft: 4, fontSize: 10 }}>· you</span>}</span>
                <HairProgress value={(p.score/max)*100} color={p.you ? "var(--accent)" : p.color} height={2}/>
              </div>
              <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                {p.score}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============ Intel modal overlay ============ */
function IntelOverlay({ open, onClose, targets, unlocked, onUnlock }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 90,
        background: "rgba(246, 244, 239, 0.55)",
        backdropFilter: "blur(14px) saturate(180%)",
        WebkitBackdropFilter: "blur(14px) saturate(180%)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "94px 28px 28px",
        animation: "fade-in 200ms ease-out",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-strong"
        style={{
          background: "rgba(255, 255, 255, 0.88)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          border: "1px solid var(--line)",
          borderRadius: 22,
          width: "min(900px, 100%)",
          boxShadow: "0 30px 80px -20px rgba(24,24,27,0.22)",
          padding: "20px 22px",
          animation: "stagger-in 320ms cubic-bezier(.2,.6,.2,1) both",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              width: 36, height: 36, borderRadius: 10,
              background: "var(--bronze-soft)", color: "var(--bronze)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 2v1.4m5.7 2.1l-1 1M16 10h-1.4m-2.1 4.6l-1-1M5.4 14.6l1-1M3.4 10H2m2.3-4.5l1 1M5 10a4 4 0 118 0c0 1.5-.8 2.7-2 3.4v1H7v-1A4 4 0 015 10z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </span>
            <div>
              <LabelMono style={{ fontSize: 9 }}>Intel — request hints</LabelMono>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 26, color: "var(--ink)", lineHeight: 1.1, letterSpacing: "-0.01em" }}>
                Briefing room
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Chip color="var(--bronze)" bg="white" border="rgba(140,109,54,0.20)">Hint −50</Chip>
            <Chip color="var(--danger)" bg="white" border="rgba(166,75,72,0.20)">Reveal −200</Chip>
            <button onClick={onClose} className="btn-icon" aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 10,
        }}>
          {targets.map((t, i) => {
            const u = unlocked[t.id] || 0;
            return (
              <div key={t.id} style={{
                border: `1px solid ${u > 0 ? "rgba(140,109,54,0.25)" : "var(--line)"}`,
                background: u > 0 ? "var(--bronze-soft)" : "rgba(255,255,255,0.6)",
                padding: "12px 14px",
                borderRadius: 14,
                transition: "all 240ms",
                minHeight: 104,
                display: "flex", flexDirection: "column",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <LabelMono style={{ fontSize: 9, color: u > 0 ? "var(--bronze)" : "var(--muted)" }}>
                    Target #{String(i+1).padStart(2,"0")}
                  </LabelMono>
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: u === 2 ? "var(--danger)" : u === 1 ? "var(--bronze)" : "var(--line-strong)",
                  }}/>
                </div>
                <div style={{
                  fontSize: 12.5, color: u > 0 ? "var(--ink-2)" : "var(--muted-2)",
                  lineHeight: 1.45,
                  flex: 1, marginBottom: 10,
                  fontFamily: u === 0 ? "'Geist Mono', monospace" : "'Geist', sans-serif",
                  letterSpacing: u === 0 ? "0.06em" : "0",
                }}>
                  {u === 0 && "▒▒▒▒▒ ▒▒▒▒▒▒ ▒▒▒ ▒▒▒"}
                  {u === 1 && t.hint}
                  {u === 2 && t.truth.slice(0, 90) + "…"}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    className="btn ghost"
                    disabled={u >= 1}
                    onClick={() => onUnlock(t.id, 1)}
                    style={{ flex: 1, fontSize: 11, padding: "5px 10px" }}
                  >Hint</button>
                  <button
                    className="btn ghost"
                    disabled={u >= 2}
                    onClick={() => onUnlock(t.id, 2)}
                    style={{ flex: 1, fontSize: 11, padding: "5px 10px", color: u >= 2 ? "" : "var(--danger)" }}
                  >Reveal</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  LabelMono, PulseDot, Divider, DataRow, HairProgress, Ring, Chip,
  TopBar, SubjectCard, MissionCard, Leaderboard, BotCursor,
  HintsPanel, Brief, Footer, Debrief, AnimatedRanking,
  SideDrawer, FloatingLeaderboard, IntelOverlay,
});
