/**
 * Fixed bottom-center dock holding the player's unused items.
 * Only shown in multiplayer, and only when there is something to use.
 */
import { ItemCard } from './ItemCard';

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
