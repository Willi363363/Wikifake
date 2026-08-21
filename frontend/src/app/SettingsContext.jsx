/**
 * Préférences du joueur.
 *
 * Auparavant stockées par `useTweaks`, le hook d'un outil de maquettage :
 * elles vivaient dans le même objet que l'état de jeu, chaque changement
 * partait en `postMessage` vers `window.parent`, et le panneau n'était visible
 * que lorsqu'un hôte de design activait le mode édition — donc jamais pour un
 * vrai joueur.
 *
 * Ce ne sont que des préférences : elles n'influencent aucune règle, aucun
 * score, et sont persistées en localStorage.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DEFAULT_ACCENT } from '../config.js';

const STORAGE_KEY = 'wikifake.settings';

export const DEFAULT_SETTINGS = {
  /** Palette d'accentuation, appliquée en variables CSS. */
  accent: DEFAULT_ACCENT,
  /** Mode expert : saisir la valeur corrigée au lieu de cocher. */
  expertMode: false,
  /** Afficher les curseurs des autres joueurs. */
  showCursors: true,
  /** Afficher le classement en direct. */
  showLeaderboard: true,
};

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    // localStorage indisponible (navigation privée, SSR) : valeurs par défaut.
    return { ...DEFAULT_SETTINGS };
  }
}

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Rien à faire : la préférence vaudra pour cette session seulement.
    }
  }, [settings]);

  const setSetting = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const value = useMemo(() => ({ settings, setSetting }), [settings, setSetting]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/**
 * Les préférences et leur setter.
 *
 * Utilisable hors provider (rendu serveur du smoke test, composant isolé) :
 * on retombe alors sur les valeurs par défaut, en lecture seule.
 */
export function useSettings() {
  return useContext(SettingsContext) ?? { settings: DEFAULT_SETTINGS, setSetting: () => {} };
}
