/**
 * LabelMono — tiny uppercase monospace label used as the caption for almost
 * every piece of HUD data. Ported verbatim from the legacy hud.jsx atoms.
 */
export function LabelMono({ children, color, style }) {
  return (
    <span className="mono" style={{
      fontSize: 10,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      color: color || "var(--muted)",
      fontWeight: 500,
      whiteSpace: "nowrap",
      ...style,
    }}>{children}</span>
  );
}
