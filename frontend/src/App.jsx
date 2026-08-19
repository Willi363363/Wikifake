import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { playSound } from './utils/soundEngine';
import { GAME_DURATION, ITEM_DEFS, TWEAK_DEFAULTS, ACCENTS } from './utils/constants';

import { 
  BlizzardEffect, LightningEffect, StaticEffect, FogEffect, 
  EarthquakeEffect, BlackoutEffect, ConfettiEffect 
} from './components/Effects';

import { 
  ArticleToken, ArticleBody, ItemCard, ItemBar, 
  ItemTargetModal, ItemNotification 
} from './components/GameComponents';

import { useBots } from './hooks/useBots';

import { Lobby } from './components/lobby.jsx';
import { LobbyChat } from './components/chat.jsx';
import { 
  TopBar, SubjectCard, MissionCard, Leaderboard, BotCursor, 
  HintsPanel, Brief, Footer, Debrief, LabelMono, Chip, 
  HairProgress, PulseDot, FloatingLeaderboard, IntelOverlay 
} from './components/hud.jsx';
import { 
  TweaksPanel, TweakSection, TweakRadio, TweakToggle, 
  TweakSlider, TweakButton, TweakSelect, TweakColor 
} from './components/tweaks-panel.jsx';
import { 
  FlagButton, FlagCaptureModal, FlagToast, FlagReportForm 
} from './components/flag-report.jsx';


export default function App() {
  const [gameState, setGameState] = useState("lobby");
  const [sessionData, setSessionData] = useState(null);

  const handleLeaveRoom = () => {
    if (sessionData?.multiplayer?.socket) {
      sessionData.multiplayer.socket.close();
    }
    setSessionData(null);
    setGameState("lobby");
  };

  const startSession = (data, timeLimit) => {
    const newBody = data.paragraphs.map((p, idx) => {
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
    playSound('start');
    setGameState("playing");
  };

  const startMultiplayerSession = (data, socket, username, roomCode, isHost) => {
    startSession(data, data.time_limit);
    setSessionData(prev => ({
      ...prev,
      multiplayer: { socket, username, roomCode, isHost }
    }));
  };

  if (gameState === "lobby") {
    return <Lobby onStart={startSession} onMultiplayerStart={startMultiplayerSession} existingMultiplayer={sessionData?.multiplayer} onLeave={handleLeaveRoom} />;
  }

  return <InnerApp sessionData={sessionData} resetSession={() => setGameState("lobby")} onLeave={handleLeaveRoom} />;
}


// Custom mock hook since it was in window originally
function useTweaks(initial) {
  const [tweaks, setTweaks] = useState(initial);
  const setTweak = (key, val) => {
    if (typeof key === "object") setTweaks(key);
    else setTweaks(prev => ({ ...prev, [key]: val }));
  };
  return [tweaks, setTweak];
}

function InnerApp({ sessionData, resetSession, onLeave }) {

  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffect(() => {
    if (sessionData) {
      setTweak({ ...t, gameState: "playing" });
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
  const [itemModal, setItemModal] = useState(null); 
  const [activeEffects, setActiveEffects] = useState([]); 
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
  const [briefOpen, setBriefOpen] = useState(false);

  // Flag-for-review feature
  const [flaggedItems, setFlaggedItems] = useState([]);
  const [flagModalOpen, setFlagModalOpen] = useState(false);
  const [showFlagToast, setShowFlagToast] = useState(false);
  const [flagReportDone, setFlagReportDone] = useState(false);
  const [scannerTrigger, setScannerTrigger] = useState(0);
  const [scannedParagraphs, setScannedParagraphs] = useState(new Set());
  const articleRef = useRef(null);

  useEffect(() => {
    const a = ACCENTS[t.accent] || ACCENTS.teal;
    document.documentElement.style.setProperty("--accent", a.primary);
    document.documentElement.style.setProperty("--accent-soft", a.soft);
    document.documentElement.style.setProperty("--accent-line", a.line);
  }, [t.accent]);

  const playing = t.gameState === "playing" && !revealAll;
  const totalFakes = window.WIKIFAKE_FAKES ? window.WIKIFAKE_FAKES.length : 0;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setTime(x => Math.max(0, x - 1)), 1000);
    return () => clearInterval(id);
  }, [playing]);

  useEffect(() => {
    if (time === 0 && playing && !revealAll) {
      playSound('game_over');
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
            playSound('item_receive');
            setItems(prev => [...prev, myItem]);
          }
        } else if (msg.type === "item_effect") {
          playSound('malus');
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
            setTimeout(() => setTimeFrozen(false), 3000); 
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

  useEffect(() => {
    if (scannerTrigger > 0) {
      const fakeTokenIds = new Set(window.WIKIFAKE_FAKES.map(f => f.tokenId));
      const unfoundFakes = [...fakeTokenIds].filter(id => !marked[id] && !edited[id] && !scannedParagraphs.has(id));
      if (unfoundFakes.length > 0) {
        const randomFake = unfoundFakes[Math.floor(Math.random() * unfoundFakes.length)];
        playSound('scanner');
        setScannedParagraphs(prev => new Set([...prev, randomFake]));
      }
    }
  }, [scannerTrigger]);

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
          playSound('click_off');
          const { [id]: _, ...rest } = prev;
          return rest;
        }
        playSound('click_on');
        return { ...prev, [id]: "" };
      });
      return;
    }
    setMarked(prev => {
      const next = { ...prev };
      if (next[id]) {
        playSound('click_off');
        delete next[id];
      } else {
        playSound('click_on');
        next[id] = true;
      }
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
    playSound('hint');
    setHintUnlocks(prev => ({ ...prev, [fakeId]: Math.max(prev[fakeId] || 0, level) }));
  };

  const hintedTokenIds = useMemo(() => {
    const s = new Set();
    if (window.WIKIFAKE_FAKES) {
      for (const f of window.WIKIFAKE_FAKES) {
        if ((hintUnlocks[f.id] || 0) >= 1) s.add(f.tokenId);
      }
    }
    return s;
  }, [hintUnlocks]);

  const hintsUsed = Object.values(hintUnlocks).filter(v => v > 0).length;
  const hintPenalty = Object.values(hintUnlocks).reduce((a, v) => a + (v === 1 ? 50 : v === 2 ? 200 : 0), 0);

  const stats = useMemo(() => {
    const markedTokens = new Set([...Object.keys(marked), ...Object.keys(edited)]);
    let tp = 0, fp = 0;
    const fakeTokenIds = window.WIKIFAKE_FAKES ? new Set(window.WIKIFAKE_FAKES.map(f => f.tokenId)) : new Set();
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
      timeStr: `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`,
      sessionId: t.sessionId,
    };
  }, [marked, edited, time, hintPenalty, totalFakes, t.sessionId, scoreStolen]);

  const useItem = useCallback((item) => {
    const def = ITEM_DEFS[item.id] || {};
    if (def.targetCount === 0) {
      if (!sessionData?.multiplayer) return;
      const socket = sessionData.multiplayer.socket;
      playSound('item_use');
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
    playSound('item_use');
    socket.send(JSON.stringify({
      type: "use_item",
      instance_id: itemModal.instance_id,
      targets: [targetName],
    }));
    setItems(prev => prev.filter(it => it.instance_id !== itemModal.instance_id));
    setItemModal(null);
  }, [itemModal, sessionData]);

  const onSubmit = () => {
    playSound('success');
    if (sessionData && sessionData.multiplayer) {
      const socket = sessionData.multiplayer.socket;
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
        color: p.color || (p.name === sessionData?.multiplayer?.username ? (ACCENTS[t.accent]?.primary || "#1f574d") : "#7a9460"),
        you: p.name === sessionData?.multiplayer?.username
      }));
    }
    if (sessionData?.multiplayer && sessionData?.players) {
      const me = sessionData.multiplayer.username;
      const all = sessionData.players.map(p => {
        const pName = typeof p === 'string' ? p : p.name;
        const pColor = typeof p === 'string' ? null : p.color;
        const isMe = pName === me;
        return {
          id: pName,
          name: pName,
          color: pColor || (isMe ? (ACCENTS[t.accent]?.primary || "#1f574d") : "#7a9460"),
          score: isMe ? youScore : (liveScores[pName] || 0),
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
  const progress = totalFakes === 0 ? 0 : Math.min(100, (markedCount / totalFakes) * 100);

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
        onOpenBrief={() => setBriefOpen(true)}
        hintsUsed={hintsUsed}
        onLogoClick={revealAll ? resetSession : undefined}
      />

      {briefOpen && (
        <Brief onClose={() => setBriefOpen(false)}>
          <SubjectCard
            facts={window.WIKIFAKE_INFOBOX || []}
            fakesTotal={totalFakes}
            fakesMarked={markedCount}
            fakesFound={markedCount}
            revealed={revealAll}
          />
          <MissionCard
            difficulty={t.difficulty}
            mode={t.mode}
            room={t.sessionId}
            total={totalFakes}
          />
        </Brief>
      )}

      <div style={{
        maxWidth: 920, margin: "26px auto 0",
        padding: "0 28px",
        position: "relative",
        zIndex: 1,
        transition: "padding-right 360ms cubic-bezier(.2,.6,.2,1)",
      }}>
        <div
          ref={articleRef}
          className={[
            earthquakeActive ? "earthquake-active" : "",
            spinActive ? "spin-active" : "",
          ].filter(Boolean).join(" ")}
          style={{
            background: "white",
            border: "1px solid var(--line)",
            borderRadius: 18,
            padding: "32px 44px 44px",
            boxShadow: "var(--shadow-md)",
            position: "relative",
            filter: [
              blurActive ? "blur(6px)" : "",
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
            <span style={{ width: 1, height: 12, background: "var(--line)" }} />
            <LabelMono>Article · Free</LabelMono>
            <span style={{ flex: 1 }} />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#0645ad", fontWeight: 500 }}>
              <span style={{ fontFamily: "'Spectral', serif", fontStyle: "italic" }}>Read</span>
            </span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Edit</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>View history</span>
          </div>

          <div className={[
            "article-body",
            blackoutActive ? "blackout-active" : "",
            tinyActive ? "tiny-active" : "",
          ].filter(Boolean).join(" ")}>
            <h1>{window.WIKIFAKE_ARTICLE ? window.WIKIFAKE_ARTICLE.title : "Loading..."}</h1>
            <p style={{ fontStyle: "italic", color: "#54595d", fontSize: 14.5, margin: "0 0 22px 0" }}>
              {window.WIKIFAKE_ARTICLE ? window.WIKIFAKE_ARTICLE.subtitle : ""}.
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

            {window.WIKIFAKE_BODY && (
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
            )}

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
                          #{String(i + 1).padStart(2, "0")}
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

          {t.multiplayer && t.showCursors && playing && Object.entries(cursors).map(([name, cur]) => {
            const playerInfo = players.find(p => p.name === name);
            if (!playerInfo || playerInfo.you) return null;
            return <BotCursor key={name} x={cur.x * window.innerWidth} y={cur.y * window.innerHeight} name={name} color={playerInfo.color} />;
          })}
        </div>

        <Footer sessionId={t.sessionId} />
      </div>

      {sessionData?.multiplayer?.socket && (
        <LobbyChat
          ws={sessionData.multiplayer.socket}
          username={sessionData.multiplayer.username}
          roomCode={sessionData.multiplayer.roomCode}
        />
      )}

      {t.multiplayer && (
        <FloatingLeaderboard players={players.slice(0, 4)} />
      )}

      <BlizzardEffect active={timeFrozen} />
      <LightningEffect active={lightningActive} />
      <StaticEffect active={hintLocked} />
      <FogEffect active={blurActive} />
      <EarthquakeEffect active={earthquakeActive} />
      <BlackoutEffect active={blackoutActive} />
      <ConfettiEffect active={confettiActive} />

      {playing && sessionData?.with_items && (
        <ItemBar
          items={items}
          onUse={useItem}
          isMultiplayer={!!sessionData?.multiplayer}
        />
      )}

      {itemModal && (
        <ItemTargetModal
          item={itemModal}
          players={players}
          myName={sessionData?.multiplayer?.username}
          onConfirm={confirmUseItem}
          onClose={() => setItemModal(null)}
        />
      )}

      <ItemNotification effects={activeEffects} />

      <IntelOverlay
        open={intelOpen && !hintLocked}
        onClose={() => setIntelOpen(false)}
        targets={window.WIKIFAKE_FAKES || []}
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

      {rickrollActive && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.88)",
          animation: "screen-flash 1.2s ease-in-out infinite",
        }}>
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
              <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, fontWeight: 600, color: "#b58f3a" }}>PUBLICITÉ INTRUSIVE #{i + 1}</div>
              <div style={{ fontSize: 9, color: "#aaa", marginTop: 4 }}>Cliquez ici pour votre cadeau...</div>
            </div>
          ))}
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

      {playing && (
        <FlagButton
          onClick={() => setFlagModalOpen(true)}
          count={flaggedItems.length}
        />
      )}
      {flagModalOpen && (
        <FlagCaptureModal
          articleTitle={window.WIKIFAKE_ARTICLE?.title}
          onSubmit={(item) => {
            setFlaggedItems(prev => [...prev, item]);
            setFlagModalOpen(false);
            setShowFlagToast(true);
          }}
          onClose={() => setFlagModalOpen(false)}
        />
      )}
      {showFlagToast && <FlagToast onDone={() => setShowFlagToast(false)} />}
      {t.gameState === "results" && flaggedItems.length > 0 && !flagReportDone && (
        <FlagReportForm
          flaggedItems={flaggedItems}
          articleTitle={window.WIKIFAKE_ARTICLE?.title}
          articleUrl={window.WIKIFAKE_INFOBOX?.find(f => f.label === "SOURCE")?.value || ""}
          sessionContext={{
            roomCode: sessionData?.multiplayer?.roomCode || "solo",
            playerName: sessionData?.multiplayer?.username || "anonymous",
          }}
          onDone={() => setFlagReportDone(true)}
        />
      )}

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
