/**
 * FlagButton — small circular floating button, bottom-right of the game
 * screen, that opens the flag-for-review capture modal. Ported verbatim
 * from flag-report.jsx.
 */
import { useState } from 'react';

export function FlagButton({ onClick, count, disabled }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      title="Signaler une erreur factuelle"
      style={{
        position: "fixed",
        bottom: 88,
        right: 24,
        zIndex: 10000,
        width: 48,
        height: 48,
        borderRadius: "50%",
        border: "none",
        background: pressed
          ? "rgba(24,24,27,0.92)"
          : hovered
            ? "rgba(24,24,27,0.82)"
            : "rgba(24,24,27,0.68)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        boxShadow: hovered && !disabled
          ? "0 6px 20px rgba(0,0,0,0.28)"
          : "0 3px 10px rgba(0,0,0,0.18)",
        transform: pressed ? "scale(0.93)" : "scale(1)",
        transition: "background 160ms, box-shadow 160ms, transform 120ms",
        opacity: disabled ? 0.35 : 1,
        outline: "none",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M3.5 2v14M3.5 2.5h10l-2.5 4 2.5 4h-10"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {count > 0 && (
        <span style={{
          position: "absolute",
          top: -3, right: -3,
          minWidth: 16, height: 16,
          padding: "0 4px",
          borderRadius: 999,
          background: "#e63946",
          color: "white",
          fontSize: 9,
          fontFamily: "'Geist Mono', monospace",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
        }}>
          {count}
        </span>
      )}
    </button>
  );
}
