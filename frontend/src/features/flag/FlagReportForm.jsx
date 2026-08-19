/**
 * FlagReportForm — end-of-session modal, shown at the results screen when
 * flaggedItems exist. Collects: proposed correction, explanation, sources.
 * Submits via lib/api (POST /api/flag-report) and shows the LLM verification
 * result. Ported from flag-report.jsx; only the raw fetch was replaced.
 */
import { useState } from 'react';
import { submitFlagReport } from '../../lib/api.js';

export function FlagReportForm({ flaggedItems, articleTitle, articleUrl, sessionContext, onDone }) {
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

      const data = await submitFlagReport({
        article_title: articleTitle || "",
        article_url: articleUrl || "",
        flagged_claim: currentItem.paragraphText || "",
        quick_note: currentItem.quickNote || "",
        proposed_correction: currentForm.proposedCorrection.trim(),
        explanation: currentForm.explanation.trim(),
        sources,
        player_id: sessionContext?.playerName || "anonymous",
        room_code: sessionContext?.roomCode || "",
      });
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
