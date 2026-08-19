import React, { useState } from 'react';
import { ITEM_DEFS } from '../utils/constants';

export function ArticleToken({ id, text, fakeId, state, expertValue, mode, onClick, onEdit, status, hinted, scanned }) {
  const cls = ["token"];
  if (status === "found") cls.push("found");
  else if (status === "missed") cls.push("missed");
  else if (status === "false-positive") cls.push("false-positive");
  else if (state === "selected") cls.push("selected");
  else if (state === "edited") cls.push("edited");
  if (hinted && !status) cls.push("hinted");
  if (scanned && !status) cls.push("scanned");

  if (mode === "expert" && state === "edited") {
    return (
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
        <span style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 13, color: "var(--bronze)",
          textDecoration: "line-through",
          textDecorationColor: "rgba(140, 109, 54, 0.55)",
          opacity: 0.7,
        }}>{text}</span>
        <span style={{ color: "var(--bronze)", fontFamily: "'Geist Mono', monospace", fontSize: 11 }}>→</span>
        <input
          className="expert-input"
          value={expertValue}
          onChange={(e) => onEdit(id, e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") onEdit(id, null); }}
          autoFocus
          placeholder="correct value"
          style={{ minWidth: Math.max(80, expertValue.length * 8) + "px" }}
        />
      </span>
    );
  }

  return (
    <span
      className={cls.join(" ")}
      data-token-id={id}
      data-fake-id={fakeId || ""}
      onClick={(e) => { e.stopPropagation(); onClick(id, fakeId); }}
    >
      {text}
    </span>
  );
}

export function ArticleBody({ marked, edited, mode, hintedTokenIds, scannedParagraphs, onTokenClick, onTokenEdit, revealAll }) {
  return (
    <>
      {window.WIKIFAKE_BODY && window.WIKIFAKE_BODY.map((block, bi) => (
        <div key={bi}>
          {block.heading && <h2>{block.heading}</h2>}
          {block.paragraphs.map((p, pi) => (
            <p key={pi}>
              {p.map((seg, si) => {
                if (typeof seg === "string") return <React.Fragment key={si}>{seg}</React.Fragment>;
                if (seg.kind === "link") return <a key={si} className="wikilink" href="#" onClick={(e) => e.preventDefault()}>{seg.text}</a>;
                if (seg.kind === "token") {
                  const m = marked[seg.id];
                  const ed = edited[seg.id];
                  const isFake = !!seg.fake;
                  let state = null;
                  if (m) state = "selected";
                  if (ed !== undefined && ed !== null) state = "edited";

                  let status = null;
                  if (revealAll) {
                    if (isFake && (m || (ed !== undefined && ed !== null))) status = "found";
                    else if (isFake) status = "missed";
                    else if (m || (ed !== undefined && ed !== null)) status = "false-positive";
                  }
                  const hinted = isFake && hintedTokenIds.has(seg.id) && !m && !ed;
                  const scanned = isFake && scannedParagraphs.has(seg.id) && !m && !ed;

                  return (
                    <ArticleToken
                      key={si}
                      id={seg.id}
                      text={seg.text}
                      fakeId={seg.fake?.id}
                      state={state}
                      expertValue={ed || ""}
                      mode={mode}
                      onClick={onTokenClick}
                      onEdit={onTokenEdit}
                      status={status}
                      hinted={hinted}
                      scanned={scanned}
                    />
                  );
                }
                return null;
              })}
            </p>
          ))}
        </div>
      ))}
    </>
  );
}

export function ItemCard({ item, onUse }) {
  const def = ITEM_DEFS[item.id] || {};
  return (
    <div
      title={def.description}
      onClick={() => onUse(item)}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        padding: "8px 12px",
        background: "white",
        border: "1px solid var(--line)",
        borderRadius: 12,
        cursor: "pointer",
        minWidth: 72,
        boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
        transition: "transform 120ms, box-shadow 120ms",
        userSelect: "none",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.12)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.07)"; }}
    >
      <span style={{ fontSize: 22 }}>{def.icon || "?"}</span>
      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", textAlign: "center" }}>
        {def.name || item.id}
      </span>
    </div>
  );
}

export function ItemBar({ items, onUse, isMultiplayer }) {
  if (!isMultiplayer || items.length === 0) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      zIndex: 90,
      display: "flex", alignItems: "center", gap: 8,
      padding: "10px 16px",
      background: "rgba(246,244,239,0.92)",
      backdropFilter: "blur(20px)",
      border: "1px solid var(--line)",
      borderRadius: 18,
      boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
    }}>
      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", marginRight: 4 }}>
        Items
      </span>
      {items.map(item => (
        <ItemCard key={item.instance_id} item={item} onUse={onUse} />
      ))}
    </div>
  );
}

export function ItemTargetModal({ item, players, myName, onConfirm, onClose }) {
  const def = ITEM_DEFS[item.id] || {};
  const [selected, setSelected] = useState(null);
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

export function ItemNotification({ effects }) {
  if (effects.length === 0) return null;
  return (
    <div style={{
      position: "fixed", top: 80, right: 24, zIndex: 300,
      display: "flex", flexDirection: "column", gap: 8,
      pointerEvents: "none",
    }}>
      {effects.map(e => (
        <div key={e.id} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px",
          background: "rgba(39,39,42,0.92)",
          color: "white",
          borderRadius: 12,
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          animation: "slide-in-right 0.2s ease-out",
          fontFamily: "'Geist', sans-serif",
          fontSize: 13,
        }}>
          <span style={{ fontSize: 18 }}>{e.icon}</span>
          <span><strong>{e.from}</strong> vous a lancé <strong>{e.name}</strong></span>
        </div>
      ))}
    </div>
  );
}
