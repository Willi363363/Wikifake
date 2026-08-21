/** Petit label monospace en capitales. */

function LabelMono({ children, color, style }) {
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

export default LabelMono;
