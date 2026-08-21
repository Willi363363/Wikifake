/** Notification d'un malus recu. */

function ItemNotification({ effects }) {
  if (effects.length === 0) return null;
  return (
    <div style={{
      position: "fixed", top: 80, right: 24, zIndex: 300,
      display: "flex", flexDirection: "column", gap: 8,
      pointerEvents: "none",
    }}>
      {effects.map(e => (
        <div key={e.id} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px",
          background: "rgba(39,39,42,0.92)",
          color: "white",
          borderRadius: 12,
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          animation: "slide-in-right 0.2s ease-out",
          fontFamily: "'Geist', sans-serif",
          fontSize: 13,
        }}>
          <span style={{ fontSize: 18 }}>{e.icon}</span>
          <span><strong>{e.from}</strong> vous a lancé <strong>{e.name}</strong></span>
        </div>
      ))}
    </div>
  );
}

// ============ Main app ============

export default ItemNotification;
