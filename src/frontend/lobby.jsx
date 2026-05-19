const { useState, useEffect, useRef } = React;

function Lobby({ onStart, onMultiplayerStart }) {
  const [mode, setMode] = useState("solo"); // solo, host, join, lobby, waiting, lobby-waiting
  const [category, setCategory] = useState("");
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Multiplayer state
  const [players, setPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);
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
    onStart(data);
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
      const res = await fetch("/api/multiplayer/create", { method: "POST" });
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
    
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "lobby_update") {
        setPlayers(msg.players);
      } else if (msg.type === "game_start") {
        // If in lobby-waiting, feed data to WaitingScreen
        if (window.__waitingScreenReady) {
          window.__waitingScreenReady(msg.data);
          // Store the multiplayer info for after waiting screen transition
          window.__multiplayerContext = { socket, name, code, isHost };
        } else {
          onMultiplayerStart(msg.data, socket, name, code, isHost);
        }
      } else if (msg.type === "error") {
        setError(msg.message);
        setLoading(false);
        setMode("lobby");
      }
    };
    
    socket.onclose = () => {
      setError("Déconnecté de la salle.");
      setMode("join");
    };
  };

  const handleStartMulti = () => {
    if (!category) {
      setError("Veuillez entrer un sujet.");
      return;
    }
    setLoading(true);
    ws.current.send(JSON.stringify({ type: "start_game", category }));
    // Transition to waiting screen inside lobby
    setMode("lobby-waiting");
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
      <window.WaitingScreen
        category={category}
        onReady={handleMultiWaitingReady}
        onError={(msg) => { setError(msg); setMode("lobby"); setLoading(false); }}
        isMultiplayer={true}
        lobbyPlayers={players}
        roomCode={roomCode}
      />
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
                  {p.answered && <span style={{color: "green"}}>Prêt</span>}
                </li>
              ))}
            </ul>
          </div>
          
          {isHost ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input
                type="text"
                placeholder="Sujet Wikipédia (ex: Paris, Python...)"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ padding: "10px", fontSize: "16px", borderRadius: "4px", border: "1px solid #ccc" }}
                disabled={loading}
              />
              <button onClick={handleStartMulti} disabled={loading || !category} style={{ padding: "12px", background: "var(--accent)", color: "white", borderRadius: "4px", border: "none", cursor: "pointer", fontWeight: "bold" }}>
                {loading ? "Génération en cours..." : "Démarrer la partie"}
              </button>
            </div>
          ) : (
            <p style={{ textAlign: "center", fontStyle: "italic", color: "var(--muted)" }}>En attente de l'hôte pour lancer la partie...</p>
          )}
          {error && <p style={{ color: "red", marginTop: "10px", textAlign: "center" }}>{error}</p>}
        </div>
      </div>
    );
  }

  // ---- MAIN LOBBY (solo/host/join selection) ----
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", backgroundColor: "var(--bg-primary)" }}>
      <div style={{ background: "white", padding: "40px", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxWidth: "450px", width: "100%" }}>
        <h2 style={{ marginBottom: "20px", color: "var(--text-primary)", textAlign: "center", fontFamily: "'Instrument Serif', serif", fontSize: "36px" }}>WikiFake</h2>
        
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <button onClick={() => {setMode("solo"); setError("");}} style={{ flex: 1, padding: "8px", background: mode === "solo" ? "var(--ink)" : "#eee", color: mode === "solo" ? "white" : "black", border: "none", borderRadius: "4px", cursor: "pointer" }}>Solo</button>
          <button onClick={() => {setMode("host"); setError("");}} style={{ flex: 1, padding: "8px", background: mode === "host" ? "var(--ink)" : "#eee", color: mode === "host" ? "white" : "black", border: "none", borderRadius: "4px", cursor: "pointer" }}>Héberger</button>
          <button onClick={() => {setMode("join"); setError("");}} style={{ flex: 1, padding: "8px", background: mode === "join" ? "var(--ink)" : "#eee", color: mode === "join" ? "white" : "black", border: "none", borderRadius: "4px", cursor: "pointer" }}>Rejoindre</button>
        </div>

        {mode === "solo" && (
          <form onSubmit={handleSoloSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <input type="text" placeholder="Sujet Wikipédia (ex: Paris)" value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: "10px", fontSize: "16px", borderRadius: "4px", border: "1px solid #ccc" }} disabled={loading} />
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
  );
}
window.Lobby = Lobby;
