/**
 * Round length picker, 30s to 10min in 30s steps.
 *
 * Shared by the solo form and the host controls so the two cannot drift apart.
 */
export function TimeLimitSlider({ value, onChange, disabled }) {
  const label = value < 60 ? `${value}s` : `${(value / 60).toFixed(1)}min`;
  return (
    <div>
      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: 'var(--ink)' }}>
        Limite de temps: {label}
      </label>
      <input
        type="range" min="30" max="600" step="30"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', padding: 0 }}
        disabled={disabled}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
        <span>30s</span>
        <span>10min</span>
      </div>
    </div>
  );
}
