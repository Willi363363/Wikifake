/**
 * Divider — 1px hairline separator, horizontal by default or vertical with
 * the `vertical` prop. Ported from hud.jsx.
 */
export function Divider({ vertical, style }) {
  return vertical
    ? <span style={{ width: 1, height: 18, background: "var(--line)", display: "inline-block", ...style }} />
    : <hr style={{ height: 1, border: 0, background: "var(--line)", margin: "12px 0", ...style }} />;
}
