/** Fiche du sujet analyse. */

import LabelMono from '@/ui/LabelMono';
import PulseDot from '@/ui/PulseDot';
import DataRow from '@/ui/DataRow';
import HairProgress from '@/ui/HairProgress';
import Chip from '@/ui/Chip';

function SubjectCard({ facts, fakesTotal, fakesMarked, fakesFound, revealed }) {
  return (
    <div className="glass" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{
        padding: "18px 20px 16px",
        borderBottom: "1px solid var(--line)",
        display: "flex", gap: 14, alignItems: "flex-start",
      }}>
        <div style={{
          width: 56, height: 70, flexShrink: 0,
          borderRadius: 8,
          background: "linear-gradient(135deg, #ede9df, #d9d5c8)",
          border: "1px solid var(--line)",
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}>
          <span style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: 24, color: "var(--muted)", fontStyle: "italic",
          }}>{(facts?.[0]?.value || "W").charAt(0).toUpperCase()}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <LabelMono>Subject</LabelMono>
          <h3 style={{
            margin: "4px 0 6px",
            fontFamily: "'Instrument Serif', serif",
            fontSize: 26, fontWeight: 400, letterSpacing: "-0.012em",
            lineHeight: 1.05,
            color: "var(--ink)",
          }}>{facts?.[0]?.value || "Sujet"}</h3>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Chip color="var(--muted)" bg="white">Wiki</Chip>
            <Chip color="var(--muted)" bg="white">Article</Chip>
          </div>
        </div>
      </div>
      <div style={{ padding: "8px 20px 20px" }}>
        {facts.map((f, i) => (
          <DataRow key={i} label={f.label} value={
            f.live ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--green)" }}>
                <PulseDot color="var(--green)" size={5} />{f.value}
              </span>
            ) : f.value
          } />
        ))}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <LabelMono>Confirmed</LabelMono>
            <span className="mono" style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              {revealed ? fakesFound : "—"} / {fakesTotal}
            </span>
          </div>
          <HairProgress value={revealed ? fakesFound : fakesMarked} max={fakesTotal} color={revealed ? "var(--green)" : "var(--accent)"} />
        </div>
      </div>
    </div>
  );
}

/* ============ Mission card ============ */

export default SubjectCard;
