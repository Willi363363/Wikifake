/** Ligne cle/valeur alignee. */

import LabelMono from '@/ui/LabelMono';

function DataRow({ label, value, color, mono = true }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      padding: "8px 0",
      borderBottom: "1px solid var(--line)",
      gap: 16,
    }}>
      <LabelMono style={{ flexShrink: 0 }}>{label}</LabelMono>
      <span style={{
        fontFamily: mono ? "'Geist Mono', monospace" : "'Geist', sans-serif",
        fontSize: 13,
        color: color || "var(--ink)",
        fontWeight: 500,
        fontVariantNumeric: "tabular-nums",
        textAlign: "right",
        whiteSpace: "nowrap",
      }}>{value}</span>
    </div>
  );
}

/* Hairline progress bar */

export default DataRow;
