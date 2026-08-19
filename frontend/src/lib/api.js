/**
 * Thin wrapper over the backend REST endpoints.
 *
 * Every function throws an Error carrying a user-facing French message, so
 * callers can render `err.message` directly.
 */

async function postJSON(url, body, fallbackMessage) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail || fallbackMessage);
  }
  return res.json();
}

/** Generate a solo round for a free-text category. */
export function startSoloGame(category) {
  return postJSON('/api/game/start', { category }, 'Erreur de génération. Essayez un autre mot-clé.');
}

/** Create an empty multiplayer room and return its join code. */
export function createRoom() {
  return postJSON('/api/multiplayer/create', {}, 'Erreur serveur.');
}

/** Submit a player-reported factual error for AI verification. */
export function submitFlagReport(report) {
  return postJSON('/api/flag-report', report, 'Erreur serveur');
}
