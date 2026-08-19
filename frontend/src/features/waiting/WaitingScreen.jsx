/**
 * Waiting screen shown while a round is generated — two-layer loading
 * experience: a simulated progress bar plus an optional mini-game launcher.
 *
 * Solo mode fetches the round itself; multiplayer rounds arrive through the
 * imperative `ready(data)` handle (exposed via ref), which replaces the old
 * `window.__waitingScreenReady` / `window.__pendingRoundData` globals.
 */
import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { startSoloGame } from '../../lib/api.js';
import { LOGO_SRC } from '../../config.js';
import { ProgressTracker } from './ProgressTracker.jsx';
import { BackgroundAnimation } from './BackgroundAnimation.jsx';
import { GameLauncher } from './GameLauncher.jsx';
import { GAMES } from './minigames';

export const WaitingScreen = forwardRef(function WaitingScreen({ category, onReady, onError, isMultiplayer, lobbyPlayers, roomCode }, ref) {
  const [progress, setProgress] = useState(0);
  const [dataReady, setDataReady] = useState(null);
  const [fadingOut, setFadingOut] = useState(false);
  const [launcherState, setLauncherState] = useState("closed"); // "closed", "selector", or game_id
  const progressRef = useRef(null);
  const fetchDone = useRef(false);
  const onReadyRef = useRef(onReady);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);

  // Simulated progress
  useEffect(() => {
    let elapsed = 0;
    const tick = () => {
      elapsed += 200;
      setProgress(prev => {
        if (fetchDone.current) return prev;
        const target = Math.min(85, (elapsed / 10000) * 85);
        const eased = 85 * (1 - Math.pow(1 - target / 85, 2.5));
        return Math.max(prev, eased);
      });
    };
    progressRef.current = setInterval(tick, 200);
    return () => clearInterval(progressRef.current);
  }, []);

  // Fetch the article data
  useEffect(() => {
    if (isMultiplayer) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await startSoloGame(category);
        if (cancelled) return;
        fetchDone.current = true;
        clearInterval(progressRef.current);
        setProgress(100);
        setDataReady(data);
      } catch (err) {
        if (!cancelled && onError) onError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [category, isMultiplayer]);

  // Imperative handle for multiplayer: the lobby calls ready(data) when the
  // round arrives, instead of the old window.__waitingScreenReady global.
  useImperativeHandle(ref, () => ({
    ready(data) {
      fetchDone.current = true;
      clearInterval(progressRef.current);
      setProgress(100);
      setDataReady(data);
    },
  }), []);

  // Transition out when data is ready
  useEffect(() => {
    if (dataReady && progress >= 100) {
      const t1 = setTimeout(() => setFadingOut(true), 700);
      const t2 = setTimeout(() => onReadyRef.current(dataReady), 1200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [dataReady, progress]);

  const toggleLauncher = () => {
    setLauncherState(prev => prev === "closed" ? "selector" : "closed");
  };

  const renderContent = () => {
    if (launcherState === "closed") {
      return (
        <div style={{ textAlign: "center", minHeight: "360px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <button className="launcher-toggle-btn" onClick={toggleLauncher}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 3.5h10M2 7h10M2 10.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Play while loading
          </button>
        </div>
      );
    }
    
    if (launcherState === "selector") {
      return (
        <div className="game-launcher-container">
          <div style={{ textAlign: "center" }}>
             <button className="launcher-toggle-btn expanded" onClick={toggleLauncher}>
                Close Launcher
             </button>
          </div>
          <GameLauncher onSelectGame={(id) => setLauncherState(id)} />
        </div>
      );
    }

    const activeGame = GAMES.find(g => g.id === launcherState);
    if (activeGame) {
      const GameComponent = activeGame.component;
      return (
        <div className="active-game-container">
           <button className="back-to-launcher" onClick={() => setLauncherState("selector")}>
             ← Back to games
           </button>
           <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, justifyContent: "center" }}>
             <span style={{ fontSize: 16, color: "var(--accent)" }}>{activeGame.icon}</span>
             <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--ink)", fontWeight: 600 }}>{activeGame.name}</span>
           </div>
           <GameComponent />
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`waiting-container${fadingOut ? " fade-out" : ""}`}>
      {launcherState === "closed" && <BackgroundAnimation />}
      <div className="waiting-card">
        {/* Header */}
        <div className="waiting-header">
          <div className="waiting-logo">
            <img src={LOGO_SRC} alt="WikiFake" />
          </div>
          <div>
            <div className="waiting-title">Wikifake</div>
            <div className="waiting-topic">{category}</div>
          </div>
        </div>

        {/* Progress */}
        <ProgressTracker progress={progress} />

        {/* Launcher or Game Content */}
        {renderContent()}

        {/* Multiplayer player list */}
        {isMultiplayer && lobbyPlayers && lobbyPlayers.length > 0 && (
          <div className="waiting-players">
            <span className="label-mono" style={{ marginRight: 4 }}>Players</span>
            {lobbyPlayers.map((p, i) => (
              <div key={i} className="waiting-player-chip">
                <span className="waiting-player-avatar">{p.name[0].toUpperCase()}</span>
                {p.name}
              </div>
            ))}
            {roomCode && (
              <span className="label-mono" style={{ marginLeft: "auto" }}>Room {roomCode}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
