/**
 * Reglages joueur.
 *
 * Remplace `tweaks-panel.jsx` (568 lignes de scaffold de maquettage qui
 * postait des messages a `window.parent` et hebergeait l'etat de jeu).
 * Ici : uniquement des preferences, persistees en localStorage.
 */

import { useState } from 'react';

import { ACCENT_OPTIONS } from '@/config/accents';
import { useSettings } from '@/state/SettingsContext';

function SettingsPanel() {
  const { settings, setSetting } = useSettings();
  const [open, setOpen] = useState(false);

  return (
    <div className={`settings-panel${open ? ' open' : ''}`}>
      <button
        type="button"
        className="settings-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        ⚙︎<span className="sr-only">Réglages</span>
      </button>

      {open && (
        <div className="settings-body">
          <p className="settings-title">Réglages</p>

          <label className="settings-row" htmlFor="setting-accent">
            <span>Palette</span>
            <select
              id="setting-accent"
              value={settings.accent}
              onChange={(event) => setSetting('accent', event.target.value)}
            >
              {ACCENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="settings-row" htmlFor="setting-sound">
            <span>Sons</span>
            <input
              id="setting-sound"
              type="checkbox"
              checked={!settings.muted}
              onChange={(event) => setSetting('muted', !event.target.checked)}
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

          <label className="settings-row" htmlFor="setting-notes">
            <span>Notes de correction</span>
            <input
              id="setting-notes"
              type="checkbox"
              checked={settings.expertNotes}
              onChange={(event) => setSetting('expertNotes', event.target.checked)}
            />
          </label>
        </div>
      )}
    </div>
  );
}

export default SettingsPanel;
