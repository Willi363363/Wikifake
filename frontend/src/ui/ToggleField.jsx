/** Interrupteur accessible (bouton + aria-pressed, navigable au clavier). */

function ToggleField({ label, checked, onChange, disabled }) {
  return (
    <button
      type="button"
      className="option-toggle"
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span>{label}</span>
      <span className="switch" aria-hidden="true" />
    </button>
  );
}

export default ToggleField;
