/** Choix de la cible d'un item. */

import React from 'react';
import { getItemDef } from '@/config/items';

function ItemTargetModal({ item, players, myName, onConfirm, onClose }) {
  const def = getItemDef(item.id);
  const [selected, setSelected] = React.useState(null);
  const targets = players.filter(p => !p.you && p.name !== myName);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.35)",
      backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "white", borderRadius: 20,
        padding: "28px 32px",
        minWidth: 320, maxWidth: 400,
        boxShadow: "0 16px 48px rgba(0,0,0,0.18)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 32 }}>{def.icon}</span>
          <div>
            <div style={{ fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 16 }}>{def.name}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{def.description}</div>
          </div>
        </div>

        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
          Choisir une cible
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {targets.length === 0 && (
            <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "12px 0" }}>Aucun autre joueur disponible</div>
          )}
          {targets.map(p => (
            <div
              key={p.id}
              onClick={() => setSelected(p.name)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", borderRadius: 10,
                border: selected === p.name ? "2px solid var(--accent)" : "1px solid var(--line)",
                background: selected === p.name ? "var(--accent-soft)" : "white",
                cursor: "pointer",
                transition: "all 120ms",
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: p.color || "#7a9460", flexShrink: 0 }} />
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 14, fontWeight: 500 }}>{p.name}</span>
              <span style={{ marginLeft: "auto", fontFamily: "'Geist Mono', monospace", fontSize: 12, color: "var(--muted)" }}>{p.score ?? 0} pts</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid var(--line)",
              background: "white", cursor: "pointer", fontFamily: "'Geist', sans-serif", fontSize: 13,
            }}
          >Annuler</button>
          <button
            disabled={!selected}
            onClick={() => selected && onConfirm(selected)}
            style={{
              flex: 2, padding: "10px 0", borderRadius: 10, border: "none",
              background: selected ? "var(--accent)" : "var(--line)",
              color: selected ? "white" : "var(--muted)",
              cursor: selected ? "pointer" : "default",
              fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 600,
              transition: "background 120ms",
            }}
          >Utiliser sur {selected || "..."}</button>
        </div>
      </div>
    </div>
  );
}

export default ItemTargetModal;
