/** Barre de progression d'un pixel. */

function HairProgress({ value, max = 100, color = "var(--accent)", height = 3 }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{
      width: "100%", height,
      background: "rgba(24, 24, 27, 0.06)",
      borderRadius: 999, overflow: "hidden",
    }}>
      <div style={{
        height: "100%", width: `${pct}%`,
        background: color,
        borderRadius: 999,
        transition: "width 600ms cubic-bezier(.2,.6,.2,1)",
      }} />
    </div>
  );
}

/* Progress ring */

export default HairProgress;
