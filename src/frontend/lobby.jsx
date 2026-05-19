const { useState, useEffect, useRef } = React;

function Lobby({ onStart, onMultiplayerStart }) {
  const [mode, setMode] = useState("solo"); // solo, host, join, lobby
  const [category, setCategory] = useState("");
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Multiplayer state
  const [players, setPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [withItems, setWithItems] = useState(true);
  const ws = useRef(null);

  const handleSoloSubmit = async (e) => {
    e.preventDefault();
    if (!category) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/game/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category })
      });
      if (!res.ok) throw new Error("Erreur de génération. Essayez un autre mot-clé.");
      const data = await res.json();
      onStart(data);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
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
        onMultiplayerStart(msg.data, socket, name, code, isHost);
      } else if (msg.type === "error") {
        setError(msg.message);
        setLoading(false);
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
    ws.current.send(JSON.stringify({ type: "start_game", category, with_items: withItems }));
  };

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
                  }}/>
                </span>
              </div>
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
