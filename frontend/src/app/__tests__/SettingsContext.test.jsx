import { act, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, SettingsProvider, useSettings } from '../SettingsContext.jsx';

const wrapper = ({ children }) => <SettingsProvider>{children}</SettingsProvider>;

describe('SettingsContext', () => {
  it('part des valeurs par défaut', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('met une préférence à jour', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setSetting('accent', 'navy'));
    expect(result.current.settings.accent).toBe('navy');
  });

  it('persiste en localStorage', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setSetting('showCursors', false));

    const stored = JSON.parse(localStorage.getItem('wikifake.settings'));
    expect(stored.showCursors).toBe(false);
  });

  it('relit les préférences enregistrées', () => {
    localStorage.setItem('wikifake.settings', JSON.stringify({ accent: 'bronze' }));
    const { result } = renderHook(() => useSettings(), { wrapper });

    expect(result.current.settings.accent).toBe('bronze');
    // Une clé absente du stockage retombe sur le défaut.
    expect(result.current.settings.showCursors).toBe(DEFAULT_SETTINGS.showCursors);
  });

  it('survit à un stockage corrompu', () => {
    localStorage.setItem('wikifake.settings', '{ pas du json');
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('fonctionne hors provider, en lecture seule', () => {
    // Le rendu serveur du smoke test et les composants isolés doivent rester
    // montables sans contexte.
    function Probe() {
      const { settings, setSetting } = useSettings();
      return <button onClick={() => setSetting('accent', 'navy')}>{settings.accent}</button>;
    }
    render(<Probe />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent(DEFAULT_SETTINGS.accent);
    act(() => button.click());
    expect(button).toHaveTextContent(DEFAULT_SETTINGS.accent);
  });

  it('ne contient aucun état de jeu', () => {
    // Régression : `gameState` vivait dans le même objet que les préférences,
    // et un sélecteur permettait de sauter au débriefing en pleine partie.
    expect(Object.keys(DEFAULT_SETTINGS)).not.toContain('gameState');
    expect(Object.keys(DEFAULT_SETTINGS)).not.toContain('sessionId');
    expect(Object.keys(DEFAULT_SETTINGS)).not.toContain('difficulty');
  });
});
