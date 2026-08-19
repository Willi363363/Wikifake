/**
 * Host switch deciding whether the round hands out sabotage items.
 */
export function ItemsToggle({ value, onChange }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        border: '1px solid #ccc', borderRadius: '4px',
        cursor: 'pointer', userSelect: 'none',
        background: value ? 'var(--accent-soft)' : '#f5f5f5',
        transition: 'background 150ms',
      }}
    >
      <span style={{ fontSize: '14px', color: 'var(--ink)' }}>🎁 Jouer avec les items</span>
      <span style={{
        width: 36, height: 20, borderRadius: 999,
        background: value ? 'var(--accent)' : '#ccc',
        position: 'relative', transition: 'background 150ms', flexShrink: 0,
      }}>
        <span style={{
          position: 'absolute', top: 3, left: value ? 19 : 3,
          width: 14, height: 14, borderRadius: '50%',
          background: 'white', transition: 'left 150ms',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </span>
    </div>
  );
}
