/**
 * PulseDot — small animated status dot (two stacked circles pulsing out of
 * phase). Signals "live" activity next to labels. Ported from hud.jsx.
 */
export function PulseDot({ color = "var(--green)", size = 6 }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: size, height: size }}>
      <span style={{
        position: "absolute", inset: 0,
        background: color, borderRadius: "50%",
        animation: "pulse-dot 1.8s ease-in-out infinite",
      }} />
      <span style={{
        position: "absolute", inset: -3,
        background: color, borderRadius: "50%",
        opacity: 0.18,
        animation: "pulse-dot 1.8s ease-in-out infinite",
        animationDelay: "0.4s",
      }} />
    </span>
  );
}
