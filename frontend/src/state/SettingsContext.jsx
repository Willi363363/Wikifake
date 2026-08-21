/**
 * Preferences utilisateur (accent, son, curseurs, mode expert).
 *
 * Remplace `useTweaks` / `tweaks-panel.jsx`, qui etait un outil de
 * maquettage : il stockait l'ETAT DE JEU (`gameState`, `mode`) et postait
 * chaque changement a `window.parent`. Ici on ne garde que de vraies
 * preferences, persistees en localStorage, sans effet sur la logique.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DEFAULT_ACCENT, applyAccent } from '@/config/accents';
import { isMuted, setMuted as persistMuted } from '@/lib/sound';

const STORAGE_KEY = 'wikifake.settings';

const DEFAULTS = {
  accent: DEFAULT_ACCENT,
  showCursors: true,
  expertNotes: false,
  muted: false,
};

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => ({ ...readStored(), muted: isMuted() }));

  useEffect(() => {
    applyAccent(settings.accent);
  }, [settings.accent]);

  useEffect(() => {
    persistMuted(settings.muted);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* mode navigation privee : on ignore */
    }
  }, [settings]);

  const setSetting = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const value = useMemo(() => ({ settings, setSetting }), [settings, setSetting]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings doit etre utilise dans <SettingsProvider>');
  return ctx;
}
