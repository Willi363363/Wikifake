/* WIKIFAKE — Waiting Screen with Two-Layer Loading Experience */
/* global React */

const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ============ PROGRESS STAGES ============
const PROGRESS_STAGES = [
  { label: "Fetching article…", threshold: 18 },
  { label: "Processing content…", threshold: 38 },
  { label: "Injecting false information…", threshold: 58 },
  { label: "Building playable page…", threshold: 78 },
  { label: "Finalizing round…", threshold: 92 },
  { label: "Ready!", threshold: 100 },
];

function ProgressTracker({ progress }) {
  const currentStage = PROGRESS_STAGES.find(s => progress <= s.threshold) || PROGRESS_STAGES[PROGRESS_STAGES.length - 1];
  const isReady = progress >= 100;

  return (
    <div className="waiting-progress">
      <div className="waiting-progress-bar">
        <div
          className="waiting-progress-fill"
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
      <div className="waiting-status">
        <span
          className="waiting-status-dot"
          style={isReady ? { background: "var(--green)", animation: "none" } : {}}
        />
        <span className="waiting-status-label">{currentStage.label}</span>
        <span className="waiting-status-pct">{Math.round(progress)}%</span>
      </div>
    </div>
  );
}

// ============ BACKGROUND ANIMATION ============
function BackgroundAnimation() {
  const lines = useMemo(() => {
    return Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      width: `${1 + Math.random() * 2}px`,
      height: `${20 + Math.random() * 60}px`,
      duration: `${3 + Math.random() * 4}s`,
      delay: `${Math.random() * -5}s`,
      opacity: 0.3 + Math.random() * 0.7,
    }));
  }, []);

  return (
    <div className="data-stream-animation">
      {lines.map(line => (
        <div
          key={line.id}
          className="ds-line"
          style={{
            left: line.left,
            width: line.width,
            height: line.height,
            animationDuration: line.duration,
            animationDelay: line.delay,
            opacity: line.opacity,
          }}
        />
      ))}
    </div>
  );
}

// ============ MINI-GAMES ============

// 1. TIC-TAC-TOE
const TTT_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

function checkWinner(board) {
  for (const line of TTT_LINES) {
    const [a,b,c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return board.every(c => c !== null) ? { winner: "draw", line: null } : null;
}

function TicTacToe() {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState(true);
  const [result, setResult] = useState(null);
  const [winLine, setWinLine] = useState(null);
  const [score, setScore] = useState({ wins: 0, draws: 0, losses: 0 });
  const aiTimeout = useRef(null);

  const resetGame = useCallback(() => {
    setBoard(Array(9).fill(null));
    setXIsNext(true);
    setResult(null);
    setWinLine(null);
  }, []);

  useEffect(() => {
    if (!xIsNext && !result) {
      aiTimeout.current = setTimeout(() => {
        setBoard(prev => {
          const empty = prev.map((v, i) => v === null ? i : -1).filter(i => i >= 0);
          if (empty.length === 0) return prev;
          const tryWin = (mark) => {
            for (const line of TTT_LINES) {
              const vals = line.map(i => prev[i]);
              const markCount = vals.filter(v => v === mark).length;
              const nullCount = vals.filter(v => v === null).length;
              if (markCount === 2 && nullCount === 1) return line[vals.indexOf(null)];
            }
            return -1;
          };
          let move = tryWin("O");
          if (move === -1) move = tryWin("X");
          if (move === -1 && prev[4] === null) move = 4;
          if (move === -1) move = empty[Math.floor(Math.random() * empty.length)];
          const next = [...prev];
          next[move] = "O";
          return next;
        });
        setXIsNext(true);
      }, 400 + Math.random() * 300);
    }
    return () => clearTimeout(aiTimeout.current);
  }, [xIsNext, result]);

  useEffect(() => {
    const res = checkWinner(board);
    if (res) {
      setResult(res.winner);
      setWinLine(res.line);
      if (res.winner === "X") setScore(s => ({ ...s, wins: s.wins + 1 }));
      else if (res.winner === "O") setScore(s => ({ ...s, losses: s.losses + 1 }));
      else setScore(s => ({ ...s, draws: s.draws + 1 }));
      setTimeout(resetGame, 1800);
    }
  }, [board, resetGame]);

  const handleClick = (i) => {
    if (board[i] || !xIsNext || result) return;
    const next = [...board];
    next[i] = "X";
    setBoard(next);
    setXIsNext(false);
  };

  const statusText = result === "X" ? "You win! ✓"
    : result === "O" ? "AI wins"
    : result === "draw" ? "Draw"
    : xIsNext ? "Your turn" : "AI thinking…";

  return (
    <div>
      <div className="ttt-grid">
        {board.map((cell, i) => (
          <div
            key={i}
            className={`ttt-cell${cell ? " taken" : ""}${winLine && winLine.includes(i) ? " win-cell" : ""}`}
            onClick={() => handleClick(i)}
          >
            {cell === "X" && <span className="x-mark">✕</span>}
            {cell === "O" && <span className="o-mark">○</span>}
          </div>
        ))}
      </div>
      <div className="ttt-status">{statusText}</div>
      <div className="ttt-score">
        <span>W {score.wins}</span>
        <span>D {score.draws}</span>
        <span>L {score.losses}</span>
      </div>
    </div>
  );
}

// 2. REACTION SPEED
function ReactionSpeed() {
  const [phase, setPhase] = useState("idle");
  const [targetPos, setTargetPos] = useState({ x: 50, y: 50 });
  const [startTime, setStartTime] = useState(0);
  const [reactionTime, setReactionTime] = useState(null);
  const [bestTime, setBestTime] = useState(null);
  const [round, setRound] = useState(0);
  const timerRef = useRef(null);

  const startRound = useCallback(() => {
    setPhase("waiting");
    setReactionTime(null);
    const delay = 1000 + Math.random() * 2500;
    timerRef.current = setTimeout(() => {
      setTargetPos({ x: 15 + Math.random() * 70, y: 15 + Math.random() * 70 });
      setStartTime(performance.now());
      setPhase("target");
    }, delay);
  }, []);

  useEffect(() => {
    startRound();
    return () => clearTimeout(timerRef.current);
  }, [round, startRound]);

  const handleTargetClick = (e) => {
    e.stopPropagation();
    if (phase !== "target") return;
    const time = Math.round(performance.now() - startTime);
    setReactionTime(time);
    setPhase("result");
    if (!bestTime || time < bestTime) setBestTime(time);
    setTimeout(() => setRound(r => r + 1), 1500);
  };

  const handleAreaClick = () => {
    if (phase === "waiting") {
      clearTimeout(timerRef.current);
      setPhase("idle");
      setReactionTime(-1);
      setTimeout(() => setRound(r => r + 1), 1200);
    }
  };

  const timeColor = reactionTime && reactionTime > 0
    ? reactionTime < 250 ? "var(--green)" : reactionTime < 400 ? "var(--accent)" : "var(--bronze)"
    : "var(--danger)";

  return (
    <div>
      <div className={`reaction-area${phase === "waiting" ? " waiting-click" : ""}`} onClick={handleAreaClick}>
        {phase === "idle" && <div className="reaction-hint">Click anywhere to start</div>}
        {phase === "waiting" && <div className="reaction-hint" style={{ color: "var(--bronze)" }}>Wait for the target…</div>}
        {phase === "target" && (
          <div
            className="reaction-target"
            style={{ left: `${targetPos.x}%`, top: `${targetPos.y}%` }}
            onClick={handleTargetClick}
          />
        )}
        {phase === "result" && reactionTime < 0 && <div className="reaction-hint" style={{ color: "var(--danger)" }}>Too early! Wait.</div>}
      </div>
      <div className="reaction-result">
        {reactionTime && reactionTime > 0 && (
          <>
            <div className="reaction-time" style={{ color: timeColor }}>{reactionTime}<small>ms</small></div>
            {bestTime && <div className="reaction-best">Best: {bestTime}ms</div>}
          </>
        )}
      </div>
    </div>
  );
}

// 3. MEMORY FLIP CARDS
const MEMORY_ICONS = ["◆", "●", "▲", "★", "♦", "♠", "♥", "♣"];
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function MemoryCards() {
  const makeCards = () => {
    const icons = MEMORY_ICONS.slice(0, 4);
    return shuffleArray([...icons, ...icons].map((icon, i) => ({ id: i, icon, matched: false })));
  };
  const [cards, setCards] = useState(makeCards);
  const [flipped, setFlipped] = useState([]);
  const [moves, setMoves] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const lockRef = useRef(false);

  const resetGame = useCallback(() => {
    setCards(makeCards());
    setFlipped([]);
    setMoves(0);
    setMatchCount(0);
    lockRef.current = false;
  }, []);

  const handleFlip = (idx) => {
    if (lockRef.current || flipped.includes(idx) || cards[idx].matched || flipped.length >= 2) return;
    const next = [...flipped, idx];
    setFlipped(next);

    if (next.length === 2) {
      setMoves(m => m + 1);
      lockRef.current = true;
      if (cards[next[0]].icon === cards[next[1]].icon) {
        setTimeout(() => {
          setCards(prev => prev.map((c, i) => i === next[0] || i === next[1] ? { ...c, matched: true } : c));
          setFlipped([]);
          setMatchCount(mc => mc + 1);
          lockRef.current = false;
        }, 500);
      } else {
        setTimeout(() => {
          setFlipped([]);
          lockRef.current = false;
        }, 900);
      }
    }
  };

  useEffect(() => {
    if (matchCount === 4) setTimeout(resetGame, 1600);
  }, [matchCount, resetGame]);

  return (
    <div>
      <div className="memory-grid">
        {cards.map((card, i) => (
          <div key={card.id} className={`memory-card${flipped.includes(i) ? " flipped" : ""}${card.matched ? " matched" : ""}`} onClick={() => handleFlip(i)}>
            <div className="memory-card-inner">
              <div className="memory-card-face memory-card-front" />
              <div className="memory-card-face memory-card-back">{card.icon}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="memory-status">{matchCount === 4 ? "All matched! ✓" : `${matchCount}/4 pairs`}</div>
      <div className="memory-moves">{moves} moves</div>
    </div>
  );
}

// 4. PATTERN MATCH
function PatternMatch() {
  const [phase, setPhase] = useState("show");
  const [pattern, setPattern] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [results, setResults] = useState(null);
  const [score, setScore] = useState(0);
  const [difficulty, setDifficulty] = useState(3);
  const timerRef = useRef(null);

  const startRound = useCallback(() => {
    const cells = new Set();
    while (cells.size < difficulty) cells.add(Math.floor(Math.random() * 16));
    setPattern([...cells]);
    setSelected(new Set());
    setResults(null);
    setPhase("show");
    timerRef.current = setTimeout(() => setPhase("recall"), 2200);
  }, [difficulty]);

  useEffect(() => {
    startRound();
    return () => clearTimeout(timerRef.current);
  }, [score, startRound]);

  const handleCellClick = (i) => {
    if (phase !== "recall") return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  useEffect(() => {
    if (phase === "recall" && selected.size === pattern.length && pattern.length > 0) {
      const patternSet = new Set(pattern);
      const correct = [...selected].every(s => patternSet.has(s));
      const resultMap = {};
      for (let i = 0; i < 16; i++) {
        if (selected.has(i) && patternSet.has(i)) resultMap[i] = "correct";
        else if (selected.has(i) && !patternSet.has(i)) resultMap[i] = "wrong";
        else if (!selected.has(i) && patternSet.has(i)) resultMap[i] = "missed";
      }
      setResults(resultMap);
      setPhase("result");
      setDifficulty(d => correct ? Math.min(7, d + 1) : Math.max(3, d - 1));
      setTimeout(() => setScore(s => s + 1), 1600);
    }
  }, [selected, phase, pattern]);

  const getCellClass = (i) => {
    if (phase === "show" && pattern.includes(i)) return "highlighted locked";
    if (phase === "result" && results) {
      if (results[i] === "correct") return "correct locked";
      if (results[i] === "wrong") return "wrong locked";
      if (results[i] === "missed") return "highlighted locked";
      return "locked";
    }
    if (phase === "recall" && selected.has(i)) return "selected";
    if (phase === "show") return "locked";
    return "";
  };

  return (
    <div>
      <div className="pattern-grid">
        {Array.from({ length: 16 }, (_, i) => (
          <div key={i} className={`pattern-cell ${getCellClass(i)}`} onClick={() => handleCellClick(i)} />
        ))}
      </div>
      <div className="pattern-info">
        {phase === "show" ? "Memorize the pattern…" : phase === "recall" ? `Select ${pattern.length} cells` : results && Object.values(results).every(v => v === "correct") ? "Perfect! ✓" : "Not quite — try again"}
      </div>
      <div className="pattern-score">Level {difficulty - 2} · Round {score + 1}</div>
    </div>
  );
}

// 5. SNAKE
function SnakeGame() {
  const [snake, setSnake] = useState([{ x: 10, y: 10 }]);
  const [dir, setDir] = useState({ x: 1, y: 0 });
  const [food, setFood] = useState({ x: 15, y: 15 });
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const boardRef = useRef(null);

  const resetGame = () => {
    setSnake([{ x: 10, y: 10 }]);
    setDir({ x: 1, y: 0 });
    setFood({ x: Math.floor(Math.random() * 24), y: Math.floor(Math.random() * 24) });
    setGameOver(false);
    setScore(0);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      switch(e.key) {
        case 'ArrowUp': case 'w': if (dir.y === 0) setDir({ x: 0, y: -1 }); break;
        case 'ArrowDown': case 's': if (dir.y === 0) setDir({ x: 0, y: 1 }); break;
        case 'ArrowLeft': case 'a': if (dir.x === 0) setDir({ x: -1, y: 0 }); break;
        case 'ArrowRight': case 'd': if (dir.x === 0) setDir({ x: 1, y: 0 }); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dir]);

  useEffect(() => {
    if (gameOver) return;
    const speed = Math.max(60, 150 - score * 5);
    const interval = setInterval(() => {
      setSnake(prev => {
        const head = { x: prev[0].x + dir.x, y: prev[0].y + dir.y };
        if (head.x < 0 || head.x >= 24 || head.y < 0 || head.y >= 24 || prev.some(seg => seg.x === head.x && seg.y === head.y)) {
          setGameOver(true);
          return prev;
        }
        const newSnake = [head, ...prev];
        if (head.x === food.x && head.y === food.y) {
          setScore(s => s + 1);
          setFood({ x: Math.floor(Math.random() * 24), y: Math.floor(Math.random() * 24) });
        } else {
          newSnake.pop();
        }
        return newSnake;
      });
    }, speed);
    return () => clearInterval(interval);
  }, [dir, food, gameOver, score]);

  return (
    <div>
      <div className="snake-board" ref={boardRef}>
        {gameOver && (
          <div className="snake-overlay">
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 24 }}>Game Over</div>
            <button className="back-to-launcher" onClick={resetGame} style={{ marginTop: 12 }}>Restart</button>
          </div>
        )}
        <div className="snake-food" style={{ left: food.x * 10, top: food.y * 10 }} />
        {snake.map((seg, i) => (
          <div key={i} className="snake-cell" style={{ left: seg.x * 10, top: seg.y * 10 }} />
        ))}
      </div>
      <div className="pattern-score" style={{ marginTop: 12 }}>Score: {score}</div>
      <div className="pattern-info" style={{ fontSize: 11 }}>Use WASD or Arrows to move</div>
    </div>
  );
}

// 6. DINO RUN
function DinoGame() {
  const [isJumping, setIsJumping] = useState(false);
  const [obstacleX, setObstacleX] = useState(320);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const jumpHeight = useRef(0);
  const obstacleRef = useRef(320);
  const scoreRef = useRef(0);

  const resetGame = (e) => {
    e.stopPropagation();
    setIsJumping(false);
    setObstacleX(320);
    setGameOver(false);
    setScore(0);
    jumpHeight.current = 0;
    obstacleRef.current = 320;
    scoreRef.current = 0;
  };

  const jump = useCallback(() => {
    if (!isJumping && !gameOver) {
      setIsJumping(true);
      let up = true;
      const jumpInterval = setInterval(() => {
        if (up) {
          jumpHeight.current += 5;
          if (jumpHeight.current >= 60) up = false;
        } else {
          jumpHeight.current -= 5;
          if (jumpHeight.current <= 0) {
            jumpHeight.current = 0;
            clearInterval(jumpInterval);
            setIsJumping(false);
          }
        }
      }, 20);
    }
  }, [isJumping, gameOver]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.code === 'Space' || e.code === 'ArrowUp') && !gameOver) {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jump, gameOver]);

  useEffect(() => {
    if (gameOver) return;
    let speed = 4;
    const gameLoop = setInterval(() => {
      obstacleRef.current -= speed;
      if (obstacleRef.current < -20) {
        obstacleRef.current = 320 + Math.random() * 100;
        scoreRef.current += 100;
        setScore(scoreRef.current);
        speed += 0.2;
      }
      setObstacleX(obstacleRef.current);

      // Collision detection
      // Player is at x: 30 to 50, y: jumpHeight to jumpHeight + 20
      // Obstacle is at x: obstacleX to obstacleX + 12, y: 0 to 24
      if (obstacleRef.current < 50 && obstacleRef.current + 12 > 30) {
        if (jumpHeight.current < 24) {
          setGameOver(true);
        }
      }
    }, 20);
    return () => clearInterval(gameLoop);
  }, [gameOver]);

  return (
    <div>
      <div className="dino-board" onClick={jump}>
        {gameOver && (
          <div className="snake-overlay">
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 24 }}>Game Over</div>
            <button className="back-to-launcher" onClick={resetGame} style={{ marginTop: 12 }}>Restart</button>
          </div>
        )}
        <div className="dino-ground" />
        <div className="dino-player" style={{ bottom: 22 + jumpHeight.current }} />
        <div className="dino-obstacle" style={{ left: obstacleX }} />
      </div>
      <div className="pattern-score" style={{ marginTop: 12 }}>Score: {score}</div>
      <div className="pattern-info" style={{ fontSize: 11 }}>Click, Space, or Up to jump</div>
    </div>
  );
}


// ============ GAME LAUNCHER ============
const GAMES = [
  { id: "ttt", name: "Tic-Tac-Toe", icon: "✕", component: TicTacToe },
  { id: "reaction", name: "Reaction Speed", icon: "⚡", component: ReactionSpeed },
  { id: "memory", name: "Memory Cards", icon: "◆", component: MemoryCards },
  { id: "pattern", name: "Pattern Match", icon: "◧", component: PatternMatch },
  { id: "snake", name: "Snake", icon: "🐍", component: SnakeGame },
  { id: "dino", name: "Agent Dash", icon: "🦖", component: DinoGame },
];

function GameLauncher({ onSelectGame }) {
  return (
    <div className="launcher-grid">
      {GAMES.map(game => (
        <div key={game.id} className="game-card" onClick={() => onSelectGame(game.id)}>
          <div className="game-icon">{game.icon}</div>
          <div className="game-card-title">{game.name}</div>
        </div>
      ))}
    </div>
  );
}


// ============ MAIN WAITING SCREEN ============
function WaitingScreen({ category, onReady, onError, isMultiplayer, lobbyPlayers, roomCode }) {
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
        const res = await fetch("/api/game/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category }),
        });
        if (cancelled) return;
        if (!res.ok) throw new Error("Erreur de génération. Essayez un autre mot-clé.");
        const data = await res.json();
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

  // Expose ready callback for multiplayer
  useEffect(() => {
    const trigger = (data) => {
      fetchDone.current = true;
      clearInterval(progressRef.current);
      setProgress(100);
      setDataReady(data);
    };

    window.__waitingScreenReady = trigger;

    // Handle race condition: round_start may have arrived BEFORE this component mounted.
    // If so, the data was stored in window.__pendingRoundData by the InnerApp handler.
    if (window.__pendingRoundData) {
      const data = window.__pendingRoundData;
      delete window.__pendingRoundData;
      trigger(data);
    }

    return () => { delete window.__waitingScreenReady; };
  }, []);

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
            <img src="/public/image.png" alt="WikiFake" />
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
}

window.WaitingScreen = WaitingScreen;
