/** Curseur d'un autre joueur. */

function BotCursor({ x, y, name, color }) {
  return (
    <div style={{
      position: "fixed", left: x, top: y, zIndex: 500, pointerEvents: "none",
      transition: "left 1.6s cubic-bezier(.4,.2,.2,1), top 1.6s cubic-bezier(.4,.2,.2,1)",
    }}>
      <svg width="16" height="16" viewBox="0 0 16 16" style={{ filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.15))` }}>
        <path d="M2 2 L2 12 L5 9 L7 14 L9 13 L7 8.5 L11 8.5 Z" fill={color} stroke="white" strokeWidth="1" strokeLinejoin="round" />
      </svg>
      <span style={{
        position: "absolute", top: 14, left: 10,
        background: color, color: "white",
        fontFamily: "'Geist Mono', monospace",
        fontSize: 9.5, fontWeight: 600,
        padding: "2px 8px",
        letterSpacing: "0.08em",
        whiteSpace: "nowrap",
        borderRadius: 999,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      }}>{name}</span>
    </div>
  );
}

/* ============ Hints panel ============ */

export default BotCursor;
