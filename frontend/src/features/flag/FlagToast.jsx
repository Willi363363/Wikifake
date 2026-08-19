/**
 * FlagToast — transient confirmation shown after a paragraph is flagged.
 * Auto-dismisses after 2.4s. Ported verbatim from flag-report.jsx.
 */
import { useEffect } from 'react';

export function FlagToast({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{
      position: "fixed",
      bottom: 90,
      right: 90,
      zIndex: 300,
      background: "var(--ink)",
      color: "white",
      padding: "10px 16px",
      borderRadius: 10,
      fontSize: 13,
      fontFamily: "'Geist', sans-serif",
      fontWeight: 500,
      display: "flex", alignItems: "center", gap: 8,
      boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
      animation: "slide-up-fade 200ms ease",
    }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 7l3.5 3.5L12 3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Contenu signalé — rapport à compléter en fin de partie
    </div>
  );
}
