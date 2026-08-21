/**
 * Test de montage complet.
 *
 * Il valide tout le graphe d'imports et le cablage React : si un module
 * reference un symbole inexistant, ce test echoue au lieu de laisser un
 * ecran blanc en production.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App';
import { ServerConfigProvider } from '../state/ServerConfigContext';
import { SettingsProvider } from '../state/SettingsContext';

const SERVER_CONFIG = {
  version: 'test',
  llmConfigured: true,
  duration: { default: 180, min: 30, max: 600 },
  maxPlayers: 8,
  maxNameLength: 20,
  maxChatLength: 400,
  items: [],
  wsCommands: [],
};

function mockFetch(routes) {
  global.fetch = vi.fn((url, options = {}) => {
    const match = Object.keys(routes).find((key) => String(url).includes(key));
    if (!match) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    const body = routes[match];
    const payload = typeof body === 'function' ? body(options) : body;
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload) });
  });
}

function renderApp() {
  return render(
    <ServerConfigProvider>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </ServerConfigProvider>,
  );
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetch({ '/api/config': SERVER_CONFIG });
  });

  it("affiche l'écran d'accueil", async () => {
    renderApp();
    expect(await screen.findByRole('heading', { name: 'WikiFake' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Solo' })).toHaveAttribute('aria-selected', 'true');
  });

  it('applique la configuration serveur au curseur de durée', async () => {
    renderApp();
    const slider = await screen.findByRole('slider');
    expect(slider).toHaveValue('180');
    expect(slider).toHaveAttribute('min', '30');
    expect(slider).toHaveAttribute('max', '600');
  });

  it('désactive le bouton solo sans sujet', async () => {
    renderApp();
    const button = await screen.findByRole('button', { name: /Lancer en solo/ });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Sujet ou catégorie/), 'Paris');
    expect(button).toBeEnabled();
  });

  it('bascule vers le formulaire "rejoindre"', async () => {
    renderApp();
    await userEvent.click(await screen.findByRole('tab', { name: 'Rejoindre' }));
    expect(screen.getByLabelText(/Code de la salle/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Votre pseudo/)).toBeInTheDocument();
  });

  it("remonte l'erreur serveur au lancement d'une partie solo", async () => {
    mockFetch({
      '/api/config': SERVER_CONFIG,
      '/api/game/start': () => {
        throw new Error('boom');
      },
    });
    global.fetch = vi.fn((url) => {
      if (String(url).includes('/api/config')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(SERVER_CONFIG) });
      }
      return Promise.resolve({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ detail: 'Sujet introuvable.' }),
      });
    });

    renderApp();
    await userEvent.type(await screen.findByLabelText(/Sujet ou catégorie/), 'zzz');
    await userEvent.click(screen.getByRole('button', { name: /Lancer en solo/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sujet introuvable.'));
  });

  it('ne stocke aucune donnée de jeu sur window', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'WikiFake' });
    // Regression : l'ancienne version passait l'article par window.WIKIFAKE_*
    const leaked = Object.keys(window).filter(
      (key) => key.startsWith('WIKIFAKE') || key.startsWith('__waiting') || key.startsWith('__multiplayer'),
    );
    expect(leaked).toEqual([]);
  });
});
