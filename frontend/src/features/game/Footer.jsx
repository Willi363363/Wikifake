/** Pied de page de l'article. */

import LabelMono from '@/ui/LabelMono';
import PulseDot from '@/ui/PulseDot';

function Footer({ sessionId }) {
  return (
    <div style={{
      maxWidth: 1320, margin: "60px auto 0",
      padding: "20px 28px 30px",
      display: "flex", gap: 20, alignItems: "center",
      borderTop: "1px solid var(--line)",
      flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 18, height: 18,
          borderRadius: 5,
          background: "linear-gradient(135deg, var(--accent), #2a7568)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white",
          fontFamily: "'Instrument Serif', serif",
          fontSize: 12, fontStyle: "italic",
        }}>W</div>
        <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 15, color: "var(--ink)" }}>Wikifake</span>
      </div>
      <LabelMono>Intelligence System · v2.0.1</LabelMono>
      <LabelMono>Session {sessionId}</LabelMono>
      <span style={{ flex: 1 }} />
      <LabelMono>© 2026 · An exercise in disinformation literacy</LabelMono>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <PulseDot color="var(--green)" size={5} />
        <LabelMono style={{ fontSize: 9 }}>Active</LabelMono>
      </span>
    </div>
  );
}

/* ============ Animated final ranking ============ */

export default Footer;
