/* WIKIFAKE — Flag-for-review system */
/* global React */
const { useState, useEffect, useRef, useCallback } = React;

// ─── helpers ────────────────────────────────────────────────────────────────

function getParagraphs() {
  try {
    return (window.WIKIFAKE_BODY || []).flatMap(section =>
      (section.paragraphs || []).map(tokens =>
        (tokens || []).map(t => t.text || "").join(" ").trim()
      )
    ).filter(p => p.length > 20);
  } catch {
    return [];
  }
}

// ─── FlagButton ──────────────────────────────────────────────────────────────
// Small circular floating button — bottom-right of the game screen.

function FlagButton({ onClick, count, disabled }) {
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

// ─── FlagCaptureModal ────────────────────────────────────────────────────────
// Lightweight in-game modal. Appears near the flag button (bottom-right).
// Player selects a paragraph and writes an optional quick note.

function FlagCaptureModal({ articleTitle, onSubmit, onClose }) {
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [quickNote, setQuickNote] = useState("");
  const paragraphs = getParagraphs();
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

// ─── FlagToast ───────────────────────────────────────────────────────────────

function FlagToast({ onDone }) {
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

// ─── FlagReportForm ──────────────────────────────────────────────────────────
// End-of-session modal. Shown at the results screen when flaggedItems exist.
// Collects: proposed correction, explanation, sources.
// Submits to /api/flag-report and shows the LLM verification result.

function FlagReportForm({ flaggedItems, articleTitle, articleUrl, sessionContext, onDone }) {
  const [step, setStep] = useState("collapsed"); // "collapsed" | "form" | "submitting" | "result"
  const [formValues, setFormValues] = useState(() =>
    flaggedItems.map(item => ({
      proposedCorrection: "",
      explanation: "",
      sources: "",
    }))
  );
  const [activeItem, setActiveItem] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const currentItem = flaggedItems[activeItem] || {};
  const currentForm = formValues[activeItem] || {};

  const setField = (field, value) => {
    setFormValues(prev => {
      const next = [...prev];
      next[activeItem] = { ...next[activeItem], [field]: value };
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!currentForm.proposedCorrection.trim()) return;
    setStep("submitting");
    setError("");
    try {
      const sources = currentForm.sources
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/flag-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article_title: articleTitle || "",
          article_url: articleUrl || "",
          flagged_claim: currentItem.paragraphText || "",
          quick_note: currentItem.quickNote || "",
          proposed_correction: currentForm.proposedCorrection.trim(),
          explanation: currentForm.explanation.trim(),
          sources,
          player_id: sessionContext?.playerName || "anonymous",
          room_code: sessionContext?.roomCode || "",
        }),
      });
      if (!res.ok) throw new Error("Erreur serveur");
      const data = await res.json();
      setResult(data);
      setStep("result");
    } catch (e) {
      setError(e.message || "Une erreur s'est produite");
      setStep("form");
    }
  };

  const verdictColors = {
    likely_valid: { text: "#166534", bg: "#dcfce7", label: "Probablement valide" },
    uncertain: { text: "#92400e", bg: "#fef3c7", label: "Incertain" },
    unsupported: { text: "#991b1b", bg: "#fee2e2", label: "Non étayé" },
  };
  const verdict = result?.verification?.verdict;
  const vc = verdictColors[verdict] || verdictColors.uncertain;

  // ── Collapsed banner ──
  if (step === "collapsed") {
    return (
      <div style={{
        position: "fixed",
        bottom: 88,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 250,
        background: "white",
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
        fontFamily: "'Geist', sans-serif",
        animation: "slide-up-fade 280ms ease",
        maxWidth: 500,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "var(--accent-soft)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
            <path d="M3.5 2v14M3.5 2.5h10l-2.5 4 2.5 4h-10" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)" }}>
            {flaggedItems.length} élément{flaggedItems.length > 1 ? "s" : ""} signalé{flaggedItems.length > 1 ? "s" : ""}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            Complétez votre rapport factuel avant de quitter
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onDone} style={{
            padding: "6px 12px", borderRadius: 8,
            border: "1px solid var(--line)",
            background: "white", color: "var(--muted)",
            fontSize: 11, cursor: "pointer",
          }}>Ignorer</button>
          <button onClick={() => setStep("form")} style={{
            padding: "6px 14px", borderRadius: 8,
            border: "none",
            background: "var(--accent)", color: "white",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>Compléter le rapport</button>
        </div>
      </div>
    );
  }

  // ── Full-screen form overlay ──
  return (
    <div style={{
      position: "fixed", inset: 0,
      zIndex: 900,
      background: "rgba(246,244,239,0.96)",
      backdropFilter: "blur(20px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
      fontFamily: "'Geist', sans-serif",
      animation: "fade-in 220ms ease",
    }}>
      <div style={{
        background: "white",
        border: "1px solid var(--line)",
        borderRadius: 18,
        width: "min(600px, 100%)",
        maxHeight: "90vh",
        overflow: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.14)",
      }}>

        {/* Header */}
        <div style={{
          padding: "22px 28px 18px",
          borderBottom: "1px solid var(--line)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "var(--accent-soft)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                <path d="M3.5 2v14M3.5 2.5h10l-2.5 4 2.5 4h-10" stroke="var(--accent)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h2 style={{ margin: 0, fontFamily: "'Instrument Serif', serif", fontSize: 22, color: "var(--ink)" }}>
                Rapport de correction factuelle
              </h2>
              <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
                Ce rapport sera vérifié par IA avant révision humaine. Aucune modification Wikipedia directe.
              </p>
            </div>
          </div>

          {/* Item tabs if multiple flagged */}
          {flaggedItems.length > 1 && step === "form" && (
            <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
              {flaggedItems.map((_, i) => (
                <button key={i} onClick={() => setActiveItem(i)} style={{
                  padding: "4px 12px", borderRadius: 999,
                  border: "1px solid var(--line)",
                  background: activeItem === i ? "var(--ink)" : "white",
                  color: activeItem === i ? "white" : "var(--muted)",
                  fontSize: 11, fontWeight: 500, cursor: "pointer",
                }}>Élément {i + 1}</button>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: "20px 28px" }}>

          {step === "form" && (
            <>
              {/* Context card */}
              <div style={{
                background: "#fafaf7",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "12px 16px",
                marginBottom: 20,
              }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>Extrait signalé</div>
                <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.6, maxHeight: 80, overflow: "hidden", WebkitLineClamp: 3, display: "-webkit-box", WebkitBoxOrient: "vertical" }}>
                  {currentItem.paragraphText || "—"}
                </div>
                {currentItem.quickNote && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>
                    Note initiale : "{currentItem.quickNote}"
                  </div>
                )}
              </div>

              {/* Proposed correction */}
              <label style={{ display: "block", marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 5 }}>
                  Correction proposée <span style={{ color: "#e63946" }}>*</span>
                </div>
                <textarea
                  value={currentForm.proposedCorrection}
                  onChange={e => setField("proposedCorrection", e.target.value)}
                  placeholder="Quelle est l'information correcte selon vous ?"
                  rows={3}
                  style={{
                    width: "100%", resize: "vertical",
                    padding: "10px 12px", borderRadius: 8,
                    border: "1px solid var(--line)",
                    fontSize: 13, fontFamily: "'Geist', sans-serif",
                    color: "var(--ink)", outline: "none",
                    boxSizing: "border-box", lineHeight: 1.55,
                  }}
                />
              </label>

              {/* Explanation */}
              <label style={{ display: "block", marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 5 }}>
                  Explication <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optionnel)</span>
                </div>
                <textarea
                  value={currentForm.explanation}
                  onChange={e => setField("explanation", e.target.value)}
                  placeholder="Pourquoi pensez-vous que c'est inexact ? Comment le savez-vous ?"
                  rows={2}
                  style={{
                    width: "100%", resize: "vertical",
                    padding: "10px 12px", borderRadius: 8,
                    border: "1px solid var(--line)",
                    fontSize: 13, fontFamily: "'Geist', sans-serif",
                    color: "var(--ink)", outline: "none",
                    boxSizing: "border-box", lineHeight: 1.55,
                  }}
                />
              </label>

              {/* Sources */}
              <label style={{ display: "block", marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 5 }}>
                  Sources <span style={{ color: "var(--muted)", fontWeight: 400 }}>(URLs séparées par des virgules, optionnel)</span>
                </div>
                <input
                  type="text"
                  value={currentForm.sources}
                  onChange={e => setField("sources", e.target.value)}
                  placeholder="https://fr.wikipedia.org/…, https://…"
                  style={{
                    width: "100%",
                    padding: "10px 12px", borderRadius: 8,
                    border: "1px solid var(--line)",
                    fontSize: 13, fontFamily: "'Geist', sans-serif",
                    color: "var(--ink)", outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </label>

              {/* Session meta */}
              <div style={{
                display: "flex", gap: 16, flexWrap: "wrap",
                fontSize: 11, color: "var(--muted)",
                padding: "10px 14px",
                background: "#fafaf7",
                borderRadius: 8,
                marginBottom: 20,
              }}>
                {articleTitle && <span>Article : <strong style={{ color: "var(--ink)" }}>{articleTitle}</strong></span>}
                {sessionContext?.roomCode && sessionContext.roomCode !== "solo" && (
                  <span>Salle : <strong style={{ color: "var(--ink)" }}>{sessionContext.roomCode}</strong></span>
                )}
                {sessionContext?.playerName && sessionContext.playerName !== "anonymous" && (
                  <span>Joueur : <strong style={{ color: "var(--ink)" }}>{sessionContext.playerName}</strong></span>
                )}
              </div>

              {error && (
                <div style={{ marginBottom: 14, padding: "8px 12px", background: "#fee2e2", borderRadius: 8, fontSize: 12, color: "#991b1b" }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={onDone} style={{
                  padding: "9px 18px", borderRadius: 9,
                  border: "1px solid var(--line)",
                  background: "white", color: "var(--muted)",
                  fontSize: 13, cursor: "pointer",
                }}>Ignorer</button>
                <button
                  onClick={handleSubmit}
                  disabled={!currentForm.proposedCorrection.trim()}
                  style={{
                    padding: "9px 20px", borderRadius: 9,
                    border: "none",
                    background: currentForm.proposedCorrection.trim() ? "var(--accent)" : "#ccc",
                    color: "white",
                    fontSize: 13, fontWeight: 600,
                    cursor: currentForm.proposedCorrection.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  Envoyer pour vérification IA
                </button>
              </div>
            </>
          )}

          {step === "submitting" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>🔍</div>
              <div style={{ fontWeight: 600, fontSize: 15, color: "var(--ink)", marginBottom: 6 }}>
                Vérification en cours…
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                L'IA recherche et analyse votre signalement.
              </div>
            </div>
          )}

          {step === "result" && result && (
            <>
              {/* Verdict badge */}
              <div style={{
                padding: "14px 18px",
                borderRadius: 10,
                background: vc.bg,
                marginBottom: 18,
                display: "flex", alignItems: "flex-start", gap: 12,
              }}>
                <div style={{ fontSize: 20, flexShrink: 0 }}>
                  {verdict === "likely_valid" ? "✅" : verdict === "uncertain" ? "⚠️" : "❌"}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: vc.text, marginBottom: 4 }}>
                    {vc.label}
                  </div>
                  <div style={{ fontSize: 13, color: vc.text, lineHeight: 1.55 }}>
                    {result.verification?.reasoning}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: vc.text, opacity: 0.8 }}>
                    Confiance IA : {result.verification?.confidence ?? "—"}%
                  </div>
                </div>
              </div>

              {/* Sources found */}
              {(result.verification?.sources_found || []).length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                    Éléments contextuels trouvés
                  </div>
                  {result.verification.sources_found.map((s, i) => (
                    <div key={i} style={{
                      fontSize: 12, color: "var(--ink)", lineHeight: 1.5,
                      padding: "8px 12px", borderLeft: "3px solid var(--accent-line)",
                      marginBottom: 6, background: "#fafaf7", borderRadius: "0 6px 6px 0",
                    }}>
                      {s}
                    </div>
                  ))}
                </div>
              )}

              {/* Status */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 14px", background: "#fafaf7",
                borderRadius: 8, marginBottom: 20,
                fontSize: 12, color: "var(--muted)",
              }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M6 3.5v3l2 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                Rapport sauvegardé (ID : <code style={{ fontSize: 10, color: "var(--ink)" }}>{result.id}</code>)
                — Statut : <strong style={{ color: "var(--ink)" }}>{result.status?.replace(/_/g, " ")}</strong>
              </div>

              <div style={{ textAlign: "right" }}>
                <button onClick={onDone} style={{
                  padding: "9px 22px", borderRadius: 9,
                  border: "none",
                  background: "var(--accent)", color: "white",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>Fermer</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Exports ─────────────────────────────────────────────────────────────────
window.FlagButton = FlagButton;
window.FlagCaptureModal = FlagCaptureModal;
window.FlagToast = FlagToast;
window.FlagReportForm = FlagReportForm;
