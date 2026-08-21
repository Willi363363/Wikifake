/** Fiche des parametres de mission. */

import LabelMono from '@/ui/LabelMono';
import Chip from '@/ui/Chip';

function MissionCard({ difficulty, total }) {
  return (
    <div className="glass" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <LabelMono>Mission</LabelMono>
        <Chip color="var(--bronze)" bg="var(--bronze-soft)" border="rgba(140,109,54,0.25)">Active</Chip>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
        <div>
          <LabelMono style={{ fontSize: 9 }}>Difficulty</LabelMono>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: "var(--ink)", lineHeight: 1.1, marginTop: 2, textTransform: "capitalize" }}>{difficulty}</div>
        </div>
        <div>
          <LabelMono style={{ fontSize: 9 }}>Targets</LabelMono>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: "var(--ink)", lineHeight: 1.1, marginTop: 2 }}>{total}<span style={{ fontSize: 14, color: "var(--muted)", marginLeft: 4 }}>hidden</span></div>
        </div>
      </div>
      <div style={{
        padding: "10px 12px",
        background: "rgba(31, 87, 77, 0.04)",
        border: "1px solid rgba(31, 87, 77, 0.10)",
        borderRadius: 10,
        fontSize: 12, lineHeight: 1.5,
        color: "var(--ink-2)",
        display: "flex", gap: 10, alignItems: "flex-start",
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginTop: 2, flexShrink: 0 }}>
          <circle cx="7" cy="7" r="5.5" stroke="var(--accent)" strokeWidth="1.2" />
          <path d="M7 4v3.5M7 9.5v.1" stroke="var(--accent)" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span>This article contains <b style={{ color: "var(--accent)", fontWeight: 600 }}>{total} deliberate falsifications</b>. Click any word to mark it as suspect.</span>
      </div>
    </div>
  );
}

/* ============ Leaderboard ============ */

export default MissionCard;
