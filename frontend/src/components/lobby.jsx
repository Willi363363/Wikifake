const { useState, useEffect, useRef } = React;

function Lobby({ onStart, onMultiplayerStart }) {
  const [mode, setMode] = useState("solo"); // solo, host, join, lobby, waiting, lobby-waiting
  const [category, setCategory] = useState("");
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timeLimit, setTimeLimit] = useState(180); // 30s to 600s (10min)
  const [maxRounds, setMaxRounds] = useState(1);
  const [isReady, setIsReady] = useState(false);
  const [themeVoting, setThemeVoting] = useState(null);
  const [myVoteTheme, setMyVoteTheme] = useState("");
  const [myVoteSubmitted, setMyVoteSubmitted] = useState(false);
  const [themeSelected, setThemeSelected] = useState(null);

  // Multiplayer state
  const [players, setPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [withItems, setWithItems] = useState(true);
  const ws = useRef(null);

  // Solo: go to waiting screen instead of fetching directly
  const handleSoloSubmit = (e) => {
    e.preventDefault();
    if (!category) return;
    setError("");
    setMode("waiting");
  };

  // Waiting screen callbacks
  const handleWaitingReady = (data) => {
    onStart(data, timeLimit);
  };

  const handleWaitingError = (msg) => {
    setError(msg);
    setMode("solo");
  };

  const handleHost = async (e) => {
    e.preventDefault();
    if (!username) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/multiplayer/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max_rounds: maxRounds })
      });
      if (!res.ok) throw new Error("Erreur serveur.");
      const data = await res.json();
      setRoomCode(data.room_code);
      setIsHost(true);
      connectWebSocket(data.room_code, username, true);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!username || !roomCode) return;
    setLoading(true);
    setError("");
    setIsHost(false);
    connectWebSocket(roomCode.toUpperCase(), username, false);
  };

  const connectWebSocket = (code, name, isHost) => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socketUrl = `${protocol}//${window.location.host}/ws/${code}/${name}`;
    const socket = new WebSocket(socketUrl);

    socket.onopen = () => {
      setLoading(false);
      setMode("lobby");
      ws.current = socket;
    };

    socket.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "lobby_update") {
        setPlayers(msg.players);
      } else if (msg.type === "theme_vote_start") {
        setThemeVoting({
          round: msg.round, maxRounds: msg.max_rounds, submitted: [], total: players.length || 1
        });
        setMyVoteSubmitted(false);
        setMyVoteTheme("");
        setThemeSelected(null);
        setMode("theme-voting");
      } else if (msg.type === "theme_vote_update") {
        setThemeVoting(prev => prev ? { ...prev, submitted: msg.submitted, total: msg.total } : null);
      } else if (msg.type === "theme_selected") {
        setThemeSelected(msg);
      } else if (msg.type === "game_start") {
        if (window.__waitingScreenReady) {
          window.__waitingScreenReady(msg.data);
          window.__multiplayerContext = { socket, name, code, isHost };
        } else {
          onMultiplayerStart(msg.data, socket, name, code, isHost);
        }
      } else if (msg.type === "error") {
        setError(msg.message);
        setLoading(false);
        setMode("lobby");
      }
    });

    socket.onclose = () => {
      setError("Déconnecté de la salle.");
      setMode("join");
    };
  };

  const handleToggleReady = () => {
    const nextReady = !isReady;
    setIsReady(nextReady);
    ws.current.send(JSON.stringify({ type: "set_ready", ready: nextReady, with_items: withItems, time_limit: timeLimit }));
  };

  const handleForceStart = () => {
    setLoading(true);
    ws.current.send(JSON.stringify({ type: "force_start", with_items: withItems, time_limit: timeLimit }));
  };

  // Multiplayer waiting: the WaitingScreen handles the transition
  const handleMultiWaitingReady = (data) => {
    const ctx = window.__multiplayerContext;
    if (ctx) {
      onMultiplayerStart(data, ctx.socket, ctx.name, ctx.code, ctx.isHost);
      delete window.__multiplayerContext;
    } else {
      onStart(data);
    }
  };

  // ---- SOLO WAITING ----
  if (mode === "waiting") {
    return (
      <window.WaitingScreen
        category={category}
        onReady={handleWaitingReady}
        onError={handleWaitingError}
        isMultiplayer={false}
      />
    );
  }

  // ---- MULTIPLAYER LOBBY WAITING ----
  if (mode === "lobby-waiting") {
    return (
      <>
        <window.WaitingScreen
          category="Un thème..."
          onReady={handleMultiWaitingReady}
          onError={(msg) => { setError(msg); setMode("lobby"); setLoading(false); }}
          isMultiplayer={true}
          lobbyPlayers={players}
          roomCode={roomCode}
        />
        {ws.current && <window.LobbyChat ws={ws.current} username={username} roomCode={roomCode} />}
      </>
    );
  }

  // ---- MULTIPLAYER THEME VOTING ----
  if (mode === "theme-voting") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", backgroundColor: "var(--bg-primary)" }}>
        <div style={{ background: "white", padding: "40px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxWidth: "500px", width: "100%" }}>
          {themeSelected ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Thème sélectionné</div>
              <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 48, margin: "10px 0", color: "var(--accent)" }}>{themeSelected.theme}</h2>
              <p style={{ color: "var(--muted)" }}>Proposé par {themeSelected.proposer}</p>
              <p style={{ marginTop: 20 }}>Lancement dans {themeSelected.countdown}s...</p>
            </div>
          ) : (
            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 36, marginBottom: 10 }}>Phase de Vote</h2>
              <p style={{ color: "var(--muted)", marginBottom: 20 }}>Round {themeVoting?.round} / {themeVoting?.maxRounds}</p>

              {!myVoteSubmitted ? (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!myVoteTheme.trim()) return;
                  ws.current.send(JSON.stringify({ type: "submit_theme", theme: myVoteTheme }));
                  setMyVoteSubmitted(true);
                }} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input type="text" placeholder="Proposer un thème..." value={myVoteTheme} onChange={e => setMyVoteTheme(e.target.value)} style={{ padding: 12, borderRadius: 8, border: "1px solid #ccc" }} />
                  <button type="submit" style={{ padding: 12, background: "var(--accent)", color: "white", borderRadius: 8, border: "none", fontWeight: "bold" }}>Soumettre le thème</button>
                </form>
              ) : (
                <div style={{ padding: 12, background: "var(--green-soft)", borderRadius: 8, color: "var(--green)", fontWeight: "bold" }}>
                  Thème soumis : {myVoteTheme}
                </div>
              )}

              <div style={{ marginTop: 20 }}>
                <p>{themeVoting?.submitted.length} / {themeVoting?.total} joueurs ont voté</p>
                {isHost && themeVoting?.submitted.length > 0 && (
                  <button onClick={() => ws.current.send(JSON.stringify({ type: "force_pick" }))} style={{ marginTop: 10, padding: "8px 16px", background: "white", border: "1px solid var(--line)", borderRadius: 8, cursor: "pointer" }}>
                    Choisir maintenant
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        {ws.current && <window.LobbyChat ws={ws.current} username={username} roomCode={roomCode} />}
      </div>
    );
  }

  // ---- MULTIPLAYER LOBBY ----
  if (mode === "lobby") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", backgroundColor: "var(--bg-primary)" }}>
        <div style={{ background: "white", padding: "40px", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxWidth: "500px", width: "100%" }}>
          <h2 style={{ textAlign: "center", fontFamily: "'Instrument Serif', serif", fontSize: "32px" }}>Salle: {roomCode}</h2>
          <div style={{ margin: "20px 0" }}>
            <h3 style={{ fontSize: "16px", color: "var(--ink)", marginBottom: "10px" }}>Joueurs ({players.length}) :</h3>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {players.map((p, i) => (
                <li key={i} style={{ padding: "8px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
                  <span>{p.name} {i === 0 ? "👑" : ""}</span>
                  {p.answered && <span style={{ color: "green" }}>Prêt</span>}
                </li>
              ))}
            </ul>
          </div>

          {isHost ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500", color: "var(--ink)" }}>
                  Nombre de rounds: {maxRounds}
                </label>
                <input type="range" min="1" max="10" step="1" value={maxRounds} onChange={(e) => setMaxRounds(Number(e.target.value))} style={{ width: "100%", padding: 0 }} disabled={loading} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                  <span>1</span>
                  <span>10</span>
                </div>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500", color: "var(--ink)" }}>
                  Limite de temps: {timeLimit < 60 ? timeLimit + "s" : (timeLimit / 60).toFixed(1) + "min"}
                </label>
                <input type="range" min="30" max="600" step="30" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} style={{ width: "100%", padding: 0 }} disabled={loading} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                  <span>30s</span>
                  <span>10min</span>
                </div>
              </div>
              <div
                onClick={() => setWithItems(v => !v)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px",
                  border: "1px solid #ccc", borderRadius: "4px",
                  cursor: "pointer", userSelect: "none",
                  background: withItems ? "var(--accent-soft)" : "#f5f5f5",
                  transition: "background 150ms",
                }}
              >
                <span style={{ fontSize: "14px", color: "var(--ink)" }}>
                  🎁 Jouer avec les items
                </span>
                <span style={{
                  width: 36, height: 20, borderRadius: 999,
                  background: withItems ? "var(--accent)" : "#ccc",
                  position: "relative", transition: "background 150ms", flexShrink: 0,
                }}>
                  <span style={{
                    position: "absolute", top: 3, left: withItems ? 19 : 3,
                    width: 14, height: 14, borderRadius: "50%",
                    background: "white", transition: "left 150ms",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </span>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={handleToggleReady} disabled={loading} style={{ flex: 1, padding: "12px", background: isReady ? "var(--green)" : "var(--bronze)", color: "white", borderRadius: "4px", border: "none", cursor: "pointer", fontWeight: "bold" }}>
                  {isReady ? "Prêt !" : "Je suis prêt"}
                </button>
                <button onClick={handleForceStart} disabled={loading} style={{ flex: 1, padding: "12px", background: "var(--accent)", color: "white", borderRadius: "4px", border: "none", cursor: "pointer", fontWeight: "bold" }}>
                  Forcer Démarrage
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <p style={{ textAlign: "center", fontStyle: "italic", color: "var(--muted)" }}>En attente de l'hôte pour lancer la partie...</p>
              <button onClick={handleToggleReady} disabled={loading} style={{ width: "100%", padding: "12px", background: isReady ? "var(--green)" : "var(--bronze)", color: "white", borderRadius: "4px", border: "none", cursor: "pointer", fontWeight: "bold" }}>
                {isReady ? "Prêt !" : "Je suis prêt"}
              </button>
            </div>
          )}
          {error && <p style={{ color: "red", marginTop: "10px", textAlign: "center" }}>{error}</p>}
        </div>
        {ws.current && <window.LobbyChat ws={ws.current} username={username} roomCode={roomCode} />}
      </div>
    );
  }

  // ---- MAIN LOBBY (solo/host/join selection) ----
  return (
    <>
      <style>{`
        input[type="range"] {
          -webkit-appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: rgba(31, 87, 77, 0.12);
          outline: none;
          cursor: pointer;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--accent);
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(31, 87, 77, 0.25);
          transition: box-shadow 200ms ease, transform 200ms ease;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          box-shadow: 0 4px 12px rgba(31, 87, 77, 0.35);
          transform: scale(1.1);
        }
        input[type="range"]::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--accent);
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 8px rgba(31, 87, 77, 0.25);
          transition: box-shadow 200ms ease, transform 200ms ease;
        }
        input[type="range"]::-moz-range-thumb:hover {
          box-shadow: 0 4px 12px rgba(31, 87, 77, 0.35);
          transform: scale(1.1);
        }
        input[type="range"]::-moz-range-track {
          background: transparent;
          border: none;
        }
        input[type="range"] disabled {
          opacity: 0.5;
        }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", backgroundColor: "var(--bg-primary)" }}>
        <div style={{ background: "white", padding: "40px", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxWidth: "450px", width: "100%" }}>
          <h2 style={{ marginBottom: "20px", color: "var(--text-primary)", textAlign: "center", fontFamily: "'Instrument Serif', serif", fontSize: "36px" }}>WikiFake</h2>

          <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
            <button onClick={() => { setMode("solo"); setError(""); }} style={{ flex: 1, padding: "8px", background: mode === "solo" ? "var(--ink)" : "#eee", color: mode === "solo" ? "white" : "black", border: "none", borderRadius: "4px", cursor: "pointer" }}>Solo</button>
            <button onClick={() => { setMode("host"); setError(""); }} style={{ flex: 1, padding: "8px", background: mode === "host" ? "var(--ink)" : "#eee", color: mode === "host" ? "white" : "black", border: "none", borderRadius: "4px", cursor: "pointer" }}>Héberger</button>
            <button onClick={() => { setMode("join"); setError(""); }} style={{ flex: 1, padding: "8px", background: mode === "join" ? "var(--ink)" : "#eee", color: mode === "join" ? "white" : "black", border: "none", borderRadius: "4px", cursor: "pointer" }}>Rejoindre</button>
          </div>

          {mode === "solo" && (
            <form onSubmit={handleSoloSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <input type="text" placeholder="Sujet Wikipédia (ex: Paris)" value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: "10px", fontSize: "16px", borderRadius: "4px", border: "1px solid #ccc" }} disabled={loading} />
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500", color: "var(--ink)" }}>
                  Limite de temps: {timeLimit < 60 ? timeLimit + "s" : (timeLimit / 60).toFixed(1) + "min"}
                </label>
                <input type="range" min="30" max="600" step="30" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} style={{ width: "100%", padding: 0 }} disabled={loading} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                  <span>30s</span>
                  <span>10min</span>
                </div>
              </div>
              <button type="submit" disabled={loading || !category} style={{ padding: "12px", background: "var(--bronze)", color: "white", borderRadius: "4px", border: "none", cursor: "pointer", fontSize: "16px", fontWeight: "bold" }}>
                {loading ? "Génération en cours..." : "Lancer en Solo"}
              </button>
            </form>
          )}

          {mode === "host" && (
            <form onSubmit={handleHost} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input type="text" placeholder="Votre Pseudo" value={username} onChange={(e) => setUsername(e.target.value)} style={{ padding: "10px", fontSize: "16px", borderRadius: "4px", border: "1px solid #ccc" }} disabled={loading} />
              <button type="submit" disabled={loading || !username} style={{ padding: "12px", background: "var(--accent)", color: "white", borderRadius: "4px", border: "none", cursor: "pointer", fontSize: "16px", fontWeight: "bold" }}>
                {loading ? "Création..." : "Créer la Salle"}
              </button>
            </form>
          )}

          {mode === "join" && (
            <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input type="text" placeholder="Code de la salle" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} style={{ padding: "10px", fontSize: "16px", borderRadius: "4px", border: "1px solid #ccc", textTransform: "uppercase" }} disabled={loading} />
              <input type="text" placeholder="Votre Pseudo" value={username} onChange={(e) => setUsername(e.target.value)} style={{ padding: "10px", fontSize: "16px", borderRadius: "4px", border: "1px solid #ccc" }} disabled={loading} />
              <button type="submit" disabled={loading || !username || !roomCode} style={{ padding: "12px", background: "var(--accent)", color: "white", borderRadius: "4px", border: "none", cursor: "pointer", fontSize: "16px", fontWeight: "bold" }}>
                {loading ? "Connexion..." : "Rejoindre"}
              </button>
            </form>
          )}

          {error && <p style={{ color: "red", marginTop: "15px", textAlign: "center" }}>{error}</p>}
        </div>
      </div>
    </>
  );
}
window.Lobby = Lobby;
