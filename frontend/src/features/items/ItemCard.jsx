/**
 * One clickable item in the bottom item bar. Hover lift is done inline
 * (mouseenter/leave) to match the legacy behaviour exactly.
 */
import { itemDef } from './catalog';

export function ItemCard({ item, onUse }) {
  const def = itemDef(item.id);
  return (
    <div
      title={def.description}
      onClick={() => onUse(item)}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        padding: "8px 12px",
        background: "white",
        border: "1px solid var(--line)",
        borderRadius: 12,
        cursor: "pointer",
        minWidth: 72,
        boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
        transition: "transform 120ms, box-shadow 120ms",
        userSelect: "none",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.12)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.07)"; }}
    >
      <span style={{ fontSize: 22 }}>{def.icon || "?"}</span>
      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", textAlign: "center" }}>
        {def.name || item.id}
      </span>
    </div>
  );
}
