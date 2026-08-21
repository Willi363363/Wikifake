/**
 * Appels HTTP. Un seul endroit connait les URLs et le format des erreurs.
 */

import { FALLBACK_CONFIG } from '@/config/constants';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Serveur injoignable. Verifiez que le backend tourne.', 0);
  }

  if (!response.ok) {
    let detail = `Erreur ${response.status}`;
    try {
      const payload = await response.json();
      if (typeof payload.detail === 'string') detail = payload.detail;
      else if (Array.isArray(payload.detail)) detail = 'Requete invalide.';
    } catch {
      /* corps non JSON : on garde le message par defaut */
    }
    throw new ApiError(detail, response.status);
  }

  return response.status === 204 ? null : response.json();
}

/** Configuration publique du serveur (durees, items, commandes WS). */
export async function fetchServerConfig() {
  try {
    return { ...FALLBACK_CONFIG, ...(await request('/api/config')) };
  } catch {
    return FALLBACK_CONFIG;
  }
}

// --- solo -----------------------------------------------------------------
export function startSoloGame(category, durationS) {
  return request('/api/game/start', {
    method: 'POST',
    body: { category, duration_s: durationS },
  });
}

export function unlockSoloHint(sessionId, targetIndex) {
  return request(`/api/game/${sessionId}/hint`, {
    method: 'POST',
    body: { target_index: targetIndex },
  });
}

export function submitSoloAnswer(sessionId, selection) {
  return request(`/api/game/${sessionId}/submit`, {
    method: 'POST',
    body: { selection },
  });
}

// --- multijoueur ----------------------------------------------------------
export function createRoom() {
  return request('/api/multiplayer/create', { method: 'POST' });
}

/** Verifie qu'un code de salle existe avant d'ouvrir un WebSocket. */
export function getRoom(code) {
  return request(`/api/multiplayer/${code.toUpperCase()}`);
}

// --- signalements ---------------------------------------------------------
export function submitFlagReport(payload) {
  return request('/api/flag-report', { method: 'POST', body: payload });
}
