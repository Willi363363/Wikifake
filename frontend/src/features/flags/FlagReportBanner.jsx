/** Banniere affichee au debrief : invite a completer le rapport factuel. */

function FlagReportBanner({ flaggedItems, onOpen, onDismiss }) {
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
        <button onClick={onDismiss} style={{
          padding: "6px 12px", borderRadius: 8,
          border: "1px solid var(--line)",
          background: "white", color: "var(--muted)",
          fontSize: 11, cursor: "pointer",
        }}>Ignorer</button>
        <button onClick={onOpen} style={{
          padding: "6px 14px", borderRadius: 8,
          border: "none",
          background: "var(--accent)", color: "white",
          fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}>Compléter le rapport</button>
      </div>
    </div>
  );
}

export default FlagReportBanner;
