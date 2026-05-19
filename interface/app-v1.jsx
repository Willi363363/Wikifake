/* WIKIFAKE — main app */
/* global React, ReactDOM, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakSlider, TweakButton, TweakSelect */
/* global HUDToolbar, HUDInfobox, GameInfoBox, Leaderboard, BotCursor, HintsPanel, InstructionBanner, HUDFooter, DebriefScreen, HUD_COLORS, labelStyle, monoStyle */
/* global WIKIFAKE_ARTICLE, WIKIFAKE_BODY, WIKIFAKE_INFOBOX, WIKIFAKE_FAKES */

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ============ Token renderer ============
function ArticleToken({ id, text, fakeId, state, expertValue, mode, onClick, onEdit, status, hinted }) {
  const cls = ["token"];
  if (status === "found") cls.push("found");
  else if (status === "missed") cls.push("missed");
  else if (status === "false-positive") cls.push("false-positive");
  else if (state === "selected") cls.push("selected");
  else if (state === "edited") cls.push("edited");
  if (hinted && !status) cls.push("hinted");

  // Expert mode editing
  if (mode === "expert" && state === "edited") {
    return (
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12, color: "#7c3aed",
          textDecoration: "line-through",
          textDecorationColor: "#7c3aed99",
          opacity: 0.6,
        }}>{text}</span>
        <span style={{ color: "#7c3aed", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>→</span>
        <input
          className="expert-input"
          value={expertValue}
          onChange={(e) => onEdit(id, e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") onEdit(id, null); }}
          autoFocus
          placeholder="correct value"
          style={{
            background: "#1a0d33",
            border: "1px solid #7c3aed",
            color: "#a78bfa",
            padding: "1px 6px",
            fontSize: 13,
            fontFamily: "'JetBrains Mono', monospace",
            minWidth: Math.max(80, expertValue.length * 8) + "px",
            borderRadius: 0,
            outline: "none",
            boxShadow: "0 0 8px #7c3aed44",
          }}
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
      title={status === "found" ? "✓ ANOMALY CONFIRMED" : status === "missed" ? "⚠ MISSED" : status === "false-positive" ? "✗ CLEAN" : null}
    >
      {text}
    </span>
  );
}

// ============ Render article body ============
function ArticleBody({ marked, edited, mode, fakeStates, hintedTokenIds, onTokenClick, onTokenEdit, revealAll }) {
  return (
    <>
      {WIKIFAKE_BODY.map((block, bi) => (
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

                  // Final reveal state
                  let status = null;
                  if (revealAll) {
                    if (isFake && (m || ed !== undefined && ed !== null)) status = "found";
                    else if (isFake) status = "missed";
                    else if (m || ed !== undefined && ed !== null) status = "false-positive";
                  }

                  const hinted = isFake && hintedTokenIds.has(seg.id) && !m && !ed;

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
function useBots(playing, totalFakes) {
  const [bots, setBots] = useState([
    { id: "alice", name: "Alice", avatar: "🦊", color: "#ff6ec7", score: 0, x: 320, y: 600, found: 0, you: false },
    { id: "bob",   name: "Bob",   avatar: "🐺", color: "#9efb6a", score: 0, x: 540, y: 820, found: 0, you: false },
  ]);

  useEffect(() => {
    if (!playing) return;
    const moveInt = setInterval(() => {
      setBots(prev => prev.map(b => {
        const dx = (Math.random() - 0.5) * 220;
        const dy = (Math.random() - 0.5) * 260;
        return {
          ...b,
          x: Math.max(120, Math.min(880, b.x + dx)),
          y: Math.max(400, Math.min(1600, b.y + dy)),
        };
      }));
    }, 1800);
    const scoreInt = setInterval(() => {
      setBots(prev => prev.map(b => {
        if (b.found >= totalFakes) return b;
        const advance = Math.random() < 0.32 ? 1 : 0;
        return {
          ...b,
          found: b.found + advance,
          score: b.score + (advance ? Math.floor(100 + Math.random() * 60) : Math.floor(Math.random() * 8)),
        };
      }));
    }, 2400);
    return () => { clearInterval(moveInt); clearInterval(scoreInt); };
  }, [playing, totalFakes]);

  return bots;
}

// ============ Main app ============
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "mode": "normal",
  "difficulty": "medium",
  "multiplayer": true,
  "scanlines": true,
  "vignette": true,
  "gameState": "playing",
  "showCursors": true,
  "sessionId": "XK9F2A"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Game state
  const [marked, setMarked] = useState({});
  const [edited, setEdited] = useState({});
  const [hintUnlocks, setHintUnlocks] = useState({}); // fakeId -> 0|1|2
  const [time, setTime] = useState(154);
  const [revealAll, setRevealAll] = useState(false);
  const [containerOffset, setContainerOffset] = useState({ left: 0, top: 0 });
  const articleRef = useRef(null);

  const playing = t.gameState === "playing" && !revealAll;
  const totalFakes = WIKIFAKE_FAKES.length;

  // Timer
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setTime(x => Math.max(0, x - 1)), 1000);
    return () => clearInterval(id);
  }, [playing]);

  // Bots
  const bots = useBots(playing && t.multiplayer && t.showCursors, totalFakes);

  // Reset state when restart
  const restart = (kind) => {
    if (kind === "new") {
      setMarked({});
      setEdited({});
      setHintUnlocks({});
      setTime(154);
      setRevealAll(false);
      setTweak("gameState", "playing");
    } else {
      // review = stay on screen but allow scroll back
      setTweak("gameState", "playing");
      setRevealAll(true);
    }
  };

  // Toggle a token
  const onTokenClick = (id, fakeId) => {
    if (revealAll) return;
    if (t.mode === "expert") {
      // start editing
      setEdited(prev => {
        if (prev[id] !== undefined && prev[id] !== null) {
          // unedit
          const { [id]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [id]: "" };
      });
      return;
    }
    setMarked(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  const onTokenEdit = (id, val) => {
    setEdited(prev => {
      if (val === null) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: val };
    });
  };

  // Hints
  const onUnlockHint = (fakeId, level) => {
    setHintUnlocks(prev => ({ ...prev, [fakeId]: Math.max(prev[fakeId] || 0, level) }));
  };
  const hintedTokenIds = useMemo(() => {
    const s = new Set();
    for (const f of WIKIFAKE_FAKES) {
      if ((hintUnlocks[f.id] || 0) >= 1) s.add(f.tokenId);
    }
    return s;
  }, [hintUnlocks]);
  const hintsUsed = Object.values(hintUnlocks).filter(v => v > 0).length;
  const hintPenalty = Object.values(hintUnlocks).reduce((a, v) => a + (v === 1 ? 50 : v === 2 ? 200 : 0), 0);

  // Compute stats
  const stats = useMemo(() => {
    const markedTokens = new Set([...Object.keys(marked), ...Object.keys(edited)]);
    let tp = 0, fp = 0;
    const fakeTokenIds = new Set(WIKIFAKE_FAKES.map(f => f.tokenId));
    for (const id of markedTokens) {
      if (fakeTokenIds.has(id)) tp++;
      else fp++;
    }
    const missed = totalFakes - tp;
    const precision = (tp + fp) === 0 ? 0 : tp / (tp + fp);
    const recall = totalFakes === 0 ? 0 : tp / totalFakes;
    const f1 = (precision + recall) === 0 ? 0 : 2 * precision * recall / (precision + recall);
    const baseScore = tp * 150;
    const fpPenalty = fp * 80;
    const timeBonus = Math.max(0, Math.floor(time * 0.5));
    const finalScore = Math.max(0, baseScore - fpPenalty - hintPenalty + timeBonus);
    return {
      truePositives: tp, falsePositives: fp, missed,
      f1, totalFakes, baseScore, fpPenalty, hintPenalty, timeBonus, finalScore,
      timeStr: `${String(Math.floor((180 - time) / 60)).padStart(2,"0")}:${String((180 - time) % 60).padStart(2,"0")}`,
      sessionId: t.sessionId,
    };
  }, [marked, edited, time, hintPenalty, totalFakes, t.sessionId]);

  const onSubmit = () => {
    setRevealAll(true);
    setTimeout(() => setTweak("gameState", "results"), 600);
  };

  // Players list (you + bots)
  const youScore = Math.max(0, Object.keys(marked).length * 120 + Object.keys(edited).length * 130 - hintPenalty);
  const players = useMemo(() => {
    const all = [
      { id: "you", name: "YOU", avatar: "🧑", color: HUD_COLORS.cyan, score: youScore, you: true },
      ...bots,
    ];
    return all.sort((a, b) => b.score - a.score);
  }, [bots, youScore]);

  const markedCount = Object.keys(marked).length + Object.keys(edited).length;
  const progress = Math.min(100, (markedCount / totalFakes) * 100);

  return (
    <div style={{ minHeight: "100vh", background: HUD_COLORS.bg, position: "relative", paddingBottom: 40 }}>
      <HUDToolbar
        mode={t.mode}
        marked={markedCount}
        total={totalFakes}
        time={time}
        hintsUsed={hintsUsed}
        hintsPenalty={hintPenalty}
        onSubmit={onSubmit}
        sessionId={t.sessionId}
        target="Paris"
        progress={progress}
        canSubmit={markedCount > 0 || revealAll}
      />

      {/* Hints + Multiplayer strip */}
      <div style={{ maxWidth: 1400, margin: "20px auto 0", padding: "0 24px", display: "grid", gridTemplateColumns: t.multiplayer ? "1fr 320px" : "1fr", gap: 16 }}>
        <HintsPanel
          targets={WIKIFAKE_FAKES}
          unlocked={hintUnlocks}
          onUnlock={onUnlockHint}
          mode={t.mode}
        />
        {t.multiplayer && <Leaderboard players={players.slice(0, 6)} />}
      </div>

      {/* Main grid: article + sidebar */}
      <div style={{
        maxWidth: 1400, margin: "20px auto 0", padding: "0 24px",
        display: "grid", gridTemplateColumns: "1fr 320px", gap: 24,
        position: "relative",
      }}>
        {/* Article — Wikipedia layer (white) */}
        <div
          ref={articleRef}
          className="crosshair-mode"
          style={{
            background: "#ffffff",
            border: `1px solid #a2a9b1`,
            padding: "30px 38px 50px",
            boxShadow: "0 0 40px rgba(0,0,0,0.5), 0 0 0 1px #00d4ff22, 0 0 0 4px #080c14, 0 0 0 5px #00d4ff44",
            position: "relative",
            minHeight: 1200,
          }}
        >
          {/* Corner crosshair markers (HUD layer over white) */}
          {[
            { top: -6, left: -6 }, { top: -6, right: -6 },
            { bottom: -6, left: -6 }, { bottom: -6, right: -6 },
          ].map((pos, i) => (
            <span key={i} style={{
              position: "absolute", ...pos, width: 14, height: 14,
              borderTop: i < 2 ? `2px solid ${HUD_COLORS.cyan}` : "none",
              borderBottom: i >= 2 ? `2px solid ${HUD_COLORS.cyan}` : "none",
              borderLeft: i % 2 === 0 ? `2px solid ${HUD_COLORS.cyan}` : "none",
              borderRight: i % 2 === 1 ? `2px solid ${HUD_COLORS.cyan}` : "none",
              boxShadow: `0 0 8px ${HUD_COLORS.cyan}`,
              pointerEvents: "none", zIndex: 20,
            }}/>
          ))}

          {/* Doc strip header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 18,
            paddingBottom: 8, borderBottom: "1px solid #eaecf0",
            ...labelStyle, fontSize: 9, color: "#54595d",
          }}>
            <span>SOURCE DOC</span>
            <span style={{ color: "#a2a9b1" }}>·</span>
            <span>OPEN ENCYCLOPEDIA · FREE ARTICLE</span>
            <span style={{ flex: 1 }}/>
            <span style={{ color: "#0645ad" }}>Read</span>
            <span style={{ color: "#54595d" }}>Edit</span>
            <span style={{ color: "#54595d" }}>View history</span>
          </div>

          <InstructionBanner mode={t.mode} />

          <div className="article-body">
            <h1>{WIKIFAKE_ARTICLE.title}</h1>
            <p style={{ fontStyle: "italic", color: "#54595d", fontSize: 14, margin: "0 0 18px 0" }}>
              {WIKIFAKE_ARTICLE.subtitle}. This article is part of a series on French cities.
            </p>

            {/* TOC */}
            <div style={{
              background: "#f8f9fa", border: "1px solid #a2a9b1", padding: "8px 12px",
              fontSize: 13, marginBottom: 18, width: "fit-content",
              fontFamily: "'Spectral', serif",
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Contents <span style={{ color: "#54595d", fontSize: 11, fontWeight: 400 }}>[hide]</span></div>
              <ol style={{ margin: 0, paddingLeft: 20, color: "#0645ad", lineHeight: 1.7 }}>
                <li>Geography</li>
                <li>History</li>
                <li>Demographics</li>
                <li>Culture and Landmarks</li>
              </ol>
            </div>

            <ArticleBody
              marked={marked}
              edited={edited}
              mode={t.mode}
              fakeStates={{}}
              hintedTokenIds={hintedTokenIds}
              onTokenClick={onTokenClick}
              onTokenEdit={onTokenEdit}
              revealAll={revealAll}
            />

            {revealAll && (
              <div style={{
                marginTop: 28, padding: "14px 18px",
                background: "#fafbfc", border: `1px solid ${HUD_COLORS.cyan}88`,
                borderLeft: `4px solid ${HUD_COLORS.cyan}`,
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                color: "#202122", lineHeight: 1.6,
              }}>
                <div style={{ ...labelStyle, color: HUD_COLORS.cyan, fontSize: 10, marginBottom: 6 }}>
                  ◈ POST-MISSION DOSSIER · CORRECTED VALUES
                </div>
                {WIKIFAKE_FAKES.map((f, i) => (
                  <div key={f.id} style={{ padding: "6px 0", borderTop: i > 0 ? "1px dashed #e0e3e6" : "none" }}>
                    <div style={{ color: "#7c3aed", fontWeight: 700 }}>#{String(i+1).padStart(2,"0")} · "{f.text}"</div>
                    <div style={{ color: "#54595d", marginTop: 2 }}>{f.truth}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bot cursors overlay */}
          {t.multiplayer && t.showCursors && playing && bots.map(b => (
            <BotCursor key={b.id} x={b.x} y={b.y} name={b.name} color={b.color} />
          ))}
        </div>

        {/* Sidebar HUD */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 130, alignSelf: "start" }}>
          <HUDInfobox
            facts={WIKIFAKE_INFOBOX}
            fakesTotal={totalFakes}
            fakesFound={revealAll ? stats.truePositives : 0}
            fakesMarked={markedCount}
          />
          <GameInfoBox
            difficulty={t.difficulty}
            mode={t.mode}
            room={t.sessionId}
            total={totalFakes}
          />

          {/* Mini telemetry panel */}
          <div style={{
            background: HUD_COLORS.bg,
            border: `1px solid ${HUD_COLORS.border}`,
            padding: "10px 14px",
            clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)",
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,212,255,0.012) 2px, rgba(0,212,255,0.012) 3px)",
          }}>
            <div style={{ ...labelStyle, fontSize: 9, color: HUD_COLORS.textDim, marginBottom: 6 }}>SCAN TELEMETRY</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, ...labelStyle, fontSize: 9 }}>
              <div>WORDS <span style={{ color: HUD_COLORS.text }}>412</span></div>
              <div>TOKENS <span style={{ color: HUD_COLORS.text }}>43</span></div>
              <div>HEAT <span style={{ color: HUD_COLORS.amber }}>0.62</span></div>
              <div>CONF <span style={{ color: HUD_COLORS.green }}>{Math.round(progress)}%</span></div>
            </div>
          </div>
        </div>
      </div>

      <HUDFooter sessionId={t.sessionId} version="2.0.1" />

      {/* Scanlines overlay */}
      {t.scanlines && <div className="scanlines" />}
      {t.vignette && <div className="vignette" />}

      {/* Drifting cyan glow blobs */}
      <div style={{
        position: "fixed", width: 420, height: 420, borderRadius: "50%",
        background: "radial-gradient(circle, #00d4ff15, transparent 70%)",
        top: "20%", left: "-100px", pointerEvents: "none", zIndex: 0,
        animation: "drift-1 18s ease-in-out infinite",
      }}/>
      <div style={{
        position: "fixed", width: 380, height: 380, borderRadius: "50%",
        background: "radial-gradient(circle, #7c3aed12, transparent 70%)",
        bottom: "10%", right: "-80px", pointerEvents: "none", zIndex: 0,
        animation: "drift-2 22s ease-in-out infinite",
      }}/>

      {/* Results modal */}
      {t.gameState === "results" && (
        <DebriefScreen stats={stats} onRestart={restart} mode={t.mode} />
      )}

      {/* TWEAKS PANEL */}
      <TweaksPanel>
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

        <TweakSection label="Multiplayer" />
        <TweakToggle label="Leaderboard" value={t.multiplayer} onChange={(v) => setTweak("multiplayer", v)} />
        <TweakToggle label="Bot cursors" value={t.showCursors} onChange={(v) => setTweak("showCursors", v)} />

        <TweakSection label="HUD Effects" />
        <TweakToggle label="Scanlines" value={t.scanlines} onChange={(v) => setTweak("scanlines", v)} />
        <TweakToggle label="Vignette" value={t.vignette} onChange={(v) => setTweak("vignette", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
