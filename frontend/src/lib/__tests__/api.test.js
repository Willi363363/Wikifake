import { describe, expect, it, vi } from 'vitest';

import {
  createRoom,
  scanSoloParagraph,
  startSoloGame,
  submitSoloAnswers,
  unlockSoloHint,
} from '../api.js';

function mockFetch(response) {
  global.fetch = vi.fn(() => Promise.resolve(response));
  return global.fetch;
}

const ok = (payload) => ({ ok: true, status: 200, json: () => Promise.resolve(payload) });

describe('appels solo', () => {
  it('transmet la catégorie et la durée', async () => {
    const fetchMock = mockFetch(ok({ session_id: 'abc' }));
    await startSoloGame('Paris', 120);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/game/start');
    expect(JSON.parse(options.body)).toEqual({ category: 'Paris', time_limit: 120 });
  });

  it('transmet la session pour un indice', async () => {
    const fetchMock = mockFetch(ok({ hint: 'x' }));
    await unlockSoloHint('sid', 2, 2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body))
      .toEqual({ session_id: 'sid', number: 2, level: 2 });
  });

  it('transmet la sélection courante au Détecteur', async () => {
    const fetchMock = mockFetch(ok({ paragraph_index: 4 }));
    await scanSoloParagraph('sid', [2]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body))
      .toEqual({ session_id: 'sid', marked: [2] });
  });

  it('n’envoie que la sélection à la soumission', async () => {
    const fetchMock = mockFetch(ok({ score: 0 }));
    await submitSoloAnswers('sid', [1, 3]);
    // Ni pénalité d'indice ni points volés : le serveur les connaît.
    expect(JSON.parse(fetchMock.mock.calls[0][1].body))
      .toEqual({ session_id: 'sid', answers: [1, 3] });
  });
});

describe('erreurs', () => {
  it('remonte le détail renvoyé par le serveur', async () => {
    mockFetch({ ok: false, status: 400, json: () => Promise.resolve({ detail: 'Sujet introuvable.' }) });
    await expect(startSoloGame('zzz')).rejects.toThrow('Sujet introuvable.');
  });

  it('retombe sur un message lisible si le corps n’est pas du JSON', async () => {
    mockFetch({ ok: false, status: 500, json: () => Promise.reject(new Error('boom')) });
    await expect(createRoom()).rejects.toThrow('Erreur serveur.');
  });
});
