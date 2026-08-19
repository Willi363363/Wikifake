/**
 * Full-screen fake pop-up storm for the RICKROLL malus.
 *
 * Unlike the other overlays this one is interactive (no pointerEvents: none):
 * it blocks the page until the victim clicks the close button, which is the
 * whole joke. Extracted verbatim from the inline modal in the legacy app.
 */
export function Rickroll({ active, onClose }) {
  if (!active) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.88)",
      animation: "screen-flash 1.2s ease-in-out infinite",
    }}>
      {/* 3 fake popup windows offset behind */}
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
      {/* Main popup */}
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
          onClick={onClose}
          style={{ fontSize: 15, padding: "11px 28px", background: "#c0392b", borderColor: "#c0392b" }}
        >
          Fermer (si vous pouvez)
        </button>
      </div>
    </div>
  );
}
