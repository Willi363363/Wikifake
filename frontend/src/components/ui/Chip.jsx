/**
 * Chip — rounded uppercase monospace pill used for statuses, modes and hint
 * costs. Ported from hud.jsx.
 */
export function Chip({ children, color = "var(--ink)", bg = "white", border = "var(--line-strong)", style }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px",
      borderRadius: 999,
      background: bg,
      border: `1px solid ${border}`,
      color,
      fontFamily: "'Geist Mono', monospace",
      fontSize: 10,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      fontWeight: 500,
      ...style,
    }}>{children}</span>
  );
}
