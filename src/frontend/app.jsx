/* WIKIFAKE — refined main app */
/* global React, ReactDOM, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakSlider, TweakButton, TweakSelect, TweakColor */
/* global TopBar, SubjectCard, MissionCard, Leaderboard, BotCursor, HintsPanel, Brief, Footer, Debrief, LabelMono, Chip, HairProgress, PulseDot, SideDrawer, FloatingLeaderboard, IntelOverlay */
/* global WIKIFAKE_ARTICLE, WIKIFAKE_BODY, WIKIFAKE_INFOBOX, window.WIKIFAKE_FAKES */

const { useState, useEffect, useRef, useMemo, useCallback } = React;

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
function ArticleToken({ id, text, fakeId, state, expertValue, mode, onClick, onEdit, status, hinted }) {
  const cls = ["token"];
  if (status === "found") cls.push("found");
  else if (status === "missed") cls.push("missed");
  else if (status === "false-positive") cls.push("false-positive");
  else if (state === "selected") cls.push("selected");
  else if (state === "edited") cls.push("edited");
  if (hinted && !status) cls.push("hinted");

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
function ArticleBody({ marked, edited, mode, hintedTokenIds, onTokenClick, onTokenEdit, revealAll }) {
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

// ============ Main app ============

function App() {
  const [gameState, setGameState] = useState("lobby");
  const [sessionData, setSessionData] = useState(null);

  const startSession = (data) => {
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
    
    setSessionData(data);
    setGameState("playing");
  };

  if (gameState === "lobby") {
    return <window.Lobby onStart={startSession} />;
  }

  // Restore the original inner App as InnerApp
  return <InnerApp sessionData={sessionData} resetSession={() => setGameState("lobby")} />;
}

function InnerApp({ sessionData, resetSession }) {

  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffect(() => {
    if (sessionData) {
      setTweak({ ...t, gameState: "playing" });
    }
  }, []);

  const [marked, setMarked] = useState({});
  const [edited, setEdited] = useState({});
  const [hintUnlocks, setHintUnlocks] = useState({});
  const [time, setTime] = useState(174);
  const [revealAll, setRevealAll] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [intelOpen, setIntelOpen] = useState(false);
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

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setTime(x => Math.max(0, x - 1)), 1000);
    return () => clearInterval(id);
  }, [playing]);

  const bots = useBots(playing && t.multiplayer && t.showCursors, totalFakes);

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

  const youScore = useMemo(() => {
    return Math.max(0, Object.keys(marked).length * 110 + Object.keys(edited).length * 130 - hintPenalty);
  }, [marked, edited, hintPenalty]);

  const players = useMemo(() => {
    const all = [
      { id: "you", name: "You", color: ACCENTS[t.accent]?.primary || "#1f574d", score: youScore, you: true },
      ...bots,
    ];
    return all.sort((a, b) => b.score - a.score);
  }, [bots, youScore, t.accent]);

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
        target="Paris"
        progress={progress}
        canSubmit={markedCount > 0 || revealAll}
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
          style={{
            background: "white",
            border: "1px solid var(--line)",
            borderRadius: 18,
            padding: "32px 44px 44px",
            boxShadow: "var(--shadow-md)",
            position: "relative",
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

          <div className="article-body">
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

          {/* Bot cursors */}
          {t.multiplayer && t.showCursors && playing && bots.map(b => (
            <BotCursor key={b.id} x={b.x} y={b.y} name={b.name} color={b.color} />
          ))}
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

      {/* INTEL OVERLAY */}
      <IntelOverlay
        open={intelOpen}
        onClose={() => setIntelOpen(false)}
        targets={window.WIKIFAKE_FAKES}
        unlocked={hintUnlocks}
        onUnlock={onUnlockHint}
      />

      {/* Results modal */}
      {t.gameState === "results" && (
        <Debrief
          stats={stats}
          onRestart={restart}
          mode={t.mode}
          allPlayers={[
            {
              id: "you", name: "You", color: ACCENTS[t.accent]?.primary || "#1f574d", you: true,
              breakdown: {
                tp: stats.truePositives,
                fp: stats.falsePositives,
                hintsUsed,
                timeBonus: stats.timeBonus,
              },
            },
            ...bots.map(b => ({
              id: b.id, name: b.name, color: b.color, you: false,
              breakdown: BOT_PROFILES[b.id],
            })),
          ]}
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
