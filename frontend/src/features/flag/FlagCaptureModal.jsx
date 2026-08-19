/**
 * FlagCaptureModal — lightweight in-game modal that appears near the flag
 * button (bottom-right). The player selects a paragraph and writes an
 * optional quick note. Ported from flag-report.jsx; the paragraphs now come
 * from the `article` prop (via paragraphTexts) instead of window.WIKIFAKE_BODY.
 */
import { useState, useEffect, useRef } from 'react';
import { paragraphTexts } from '../../lib/article.js';

export function FlagCaptureModal({ article, articleTitle, onSubmit, onClose }) {
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [quickNote, setQuickNote] = useState("");
  const paragraphs = paragraphTexts(article);
  const ref = useRef(null);

  // Close on Escape
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Focus trap click-outside
  useEffect(() => {
    const onClick = e => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    setTimeout(() => document.addEventListener("mousedown", onClick), 50);
    return () => document.removeEventListener("mousedown", onClick);
  }, [onClose]);

  const handleSubmit = () => {
    if (selectedIdx === null) return;
    onSubmit({
      paragraphIndex: selectedIdx,
      paragraphText: paragraphs[selectedIdx] || "",
      quickNote: quickNote.trim(),
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <div style={{
      position: "fixed",
      bottom: 90,
      right: 28,
      zIndex: 400,
      width: 380,
      maxHeight: "70vh",
      background: "white",
      borderRadius: 14,
      border: "1px solid var(--line)",
      boxShadow: "0 12px 40px rgba(0,0,0,0.16)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      animation: "slide-up-fade 200ms ease",
      fontFamily: "'Geist', sans-serif",
    }} ref={ref}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 18px 12px",
        borderBottom: "1px solid var(--line)",
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>
            Signaler une erreur factuelle
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Pas une fausse info du jeu — une vraie erreur Wikipedia
          </div>
        </div>
        <button onClick={onClose} style={{
          border: "none", background: "none", cursor: "pointer",
          color: "var(--muted)", fontSize: 18, lineHeight: 1, padding: 4,
        }}>×</button>
      </div>

      {/* Article label */}
      <div style={{ padding: "10px 18px 0", fontSize: 11, color: "var(--muted)" }}>
        Article : <strong style={{ color: "var(--ink)" }}>{articleTitle || "—"}</strong>
      </div>

      {/* Paragraph selector */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "10px 18px 0",
      }}>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, fontWeight: 500 }}>
          Quel extrait vous semble factuelment inexact ?
        </div>
        {paragraphs.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>
            Aucun paragraphe disponible.
          </div>
        ) : (
          paragraphs.map((p, i) => (
            <div
              key={i}
              onClick={() => setSelectedIdx(i)}
              style={{
                padding: "8px 10px",
                marginBottom: 6,
                borderRadius: 8,
                border: selectedIdx === i
                  ? "1.5px solid var(--accent)"
                  : "1px solid var(--line)",
                background: selectedIdx === i
                  ? "var(--accent-soft)"
                  : "transparent",
                cursor: "pointer",
                fontSize: 12,
                lineHeight: 1.5,
                color: "var(--ink)",
                transition: "background 120ms, border-color 120ms",
              }}
            >
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, color: "var(--muted)", marginRight: 6 }}>
                §{i + 1}
              </span>
              {p.length > 140 ? p.slice(0, 140) + "…" : p}
            </div>
          ))
        )}
      </div>

      {/* Quick note */}
      <div style={{ padding: "10px 18px 0" }}>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4, fontWeight: 500 }}>
          Note rapide (optionnel)
        </div>
        <textarea
          value={quickNote}
          onChange={e => setQuickNote(e.target.value)}
          placeholder="Ex: la date indiquée semble incorrecte…"
          rows={2}
          style={{
            width: "100%",
            resize: "none",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--line)",
            fontSize: 12,
            fontFamily: "'Geist', sans-serif",
            color: "var(--ink)",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Actions */}
      <div style={{ padding: "12px 18px 14px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onClose} style={{
          padding: "7px 14px", borderRadius: 8,
          border: "1px solid var(--line)",
          background: "white", color: "var(--ink)",
          fontSize: 12, fontWeight: 500, cursor: "pointer",
        }}>Annuler</button>
        <button
          onClick={handleSubmit}
          disabled={selectedIdx === null}
          style={{
            padding: "7px 16px", borderRadius: 8,
            border: "none",
            background: selectedIdx !== null ? "var(--ink)" : "#ccc",
            color: "white",
            fontSize: 12, fontWeight: 600,
            cursor: selectedIdx !== null ? "pointer" : "not-allowed",
            transition: "background 160ms",
          }}
        >
          Signaler
        </button>
      </div>
    </div>
  );
}
