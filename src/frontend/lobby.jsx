const { useState } = React;

function Lobby({ onStart }) {
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
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
      if (!res.ok) {
        throw new Error("Erreur de génération. Essayez un autre mot-clé.");
      }
      const data = await res.json();
      onStart(data);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", backgroundColor: "var(--bg-primary)" }}>
      <div style={{ background: "white", padding: "40px", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxWidth: "400px", width: "100%" }}>
        <h2 style={{ marginBottom: "20px", color: "var(--text-primary)", textAlign: "center", fontFamily: "'Instrument Serif', serif", fontSize: "32px" }}>Nouvelle Enquête</h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <input
            type="text"
            placeholder="Sujet Wikipédia (ex: Paris, Python...)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ padding: "10px", fontSize: "16px", borderRadius: "4px", border: "1px solid #ccc" }}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !category} style={{ padding: "12px", background: "var(--bronze)", color: "white", borderRadius: "4px", border: "none", cursor: "pointer", fontSize: "16px", fontWeight: "bold" }}>
            {loading ? "Génération en cours..." : "Lancer la recherche"}
          </button>
        </form>
        {error && <p style={{ color: "red", marginTop: "10px", textAlign: "center" }}>{error}</p>}
      </div>
    </div>
  );
}
window.Lobby = Lobby;
