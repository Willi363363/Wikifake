/**
 * Réglages du joueur, accessibles en partie.
 *
 * Remplace `GameTweaks`, qui n'apparaissait que si un hôte de design activait
 * le mode édition — et qui pilotait aussi l'écran affiché, c'est-à-dire
 * l'état de jeu. Ici : uniquement des préférences.
 */
import { useState } from 'react';

import { ACCENTS } from '../../config.js';
import { useSettings } from '../../app/SettingsContext.jsx';

const ACCENT_LABELS = {
  teal: 'Vert enquêteur',
  navy: 'Bleu éditorial',
  bronze: 'Bronze',
  aubergine: 'Aubergine',
  graphite: 'Graphite',
};

export function SettingsPanel() {
  const { settings, setSetting } = useSettings();
  const [open, setOpen] = useState(false);

  return (
    <div className="settings-panel">
      <button
        type="button"
        className="settings-toggle"
        aria-expanded={open}
        aria-label="Réglages"
        onClick={() => setOpen((value) => !value)}
      >
        ⚙
      </button>

      {open && (
        <div className="settings-body" role="group" aria-label="Réglages">
          <p className="settings-title">Réglages</p>

          <label className="settings-row" htmlFor="setting-accent">
            <span>Palette</span>
            <select
              id="setting-accent"
              value={settings.accent}
              onChange={(event) => setSetting('accent', event.target.value)}
            >
              {Object.keys(ACCENTS).map((name) => (
                <option key={name} value={name}>{ACCENT_LABELS[name] || name}</option>
              ))}
            </select>
          </label>

          <label className="settings-row" htmlFor="setting-expert">
            <span>Mode expert</span>
            <input
              id="setting-expert"
              type="checkbox"
              checked={settings.expertMode}
              onChange={(event) => setSetting('expertMode', event.target.checked)}
            />
          </label>

          <label className="settings-row" htmlFor="setting-cursors">
            <span>Curseurs des joueurs</span>
            <input
              id="setting-cursors"
              type="checkbox"
              checked={settings.showCursors}
              onChange={(event) => setSetting('showCursors', event.target.checked)}
            />
          </label>

          <label className="settings-row" htmlFor="setting-leaderboard">
            <span>Classement en direct</span>
            <input
              id="setting-leaderboard"
              type="checkbox"
              checked={settings.showLeaderboard}
              onChange={(event) => setSetting('showLeaderboard', event.target.checked)}
            />
          </label>
        </div>
      )}
    </div>
  );
}
