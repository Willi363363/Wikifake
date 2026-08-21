/** Onglets de selection de mode (role=tablist pour l'accessibilite). */

function ModeTabs({ modes, value, onChange }) {
  return (
    <div className="lobby-tabs" role="tablist" aria-label="Mode de jeu">
      {modes.map((mode) => (
        <button
          key={mode.value}
          type="button"
          role="tab"
          aria-selected={value === mode.value}
          className="lobby-tab"
          onClick={() => onChange(mode.value)}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

export default ModeTabs;
