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

/**
 * Generate a solo round for a free-text category.
 *
 * The payload holds the article only — no `positions`. The solution stays on
 * the server until `submitSoloAnswers`, and hints are bought one by one.
 */
export function startSoloGame(category, timeLimit) {
  return postJSON(
    '/api/game/start',
    { category, time_limit: timeLimit },
    'Erreur de génération. Essayez un autre mot-clé.',
  );
}

/** Buy one hint (level 1) or reveal a target (level 2). Billed server-side. */
export function unlockSoloHint(sessionId, number, level) {
  return postJSON(
    '/api/game/hint',
    { session_id: sessionId, number, level },
    'Indice indisponible.',
  );
}

/** Détecteur item: ask the server for a sabotaged paragraph not yet found. */
export function scanSoloParagraph(sessionId, marked) {
  return postJSON(
    '/api/game/scan',
    { session_id: sessionId, marked },
    'Détecteur indisponible.',
  );
}

/** Close a solo round: returns the score breakdown and the full solution. */
export function submitSoloAnswers(sessionId, answers) {
  return postJSON(
    '/api/game/submit',
    { session_id: sessionId, answers },
    'Erreur de correction.',
  );
}

/** Create an empty multiplayer room and return its join code. */
export function createRoom() {
  return postJSON('/api/multiplayer/create', {}, 'Erreur serveur.');
}

/** Submit a player-reported factual error for AI verification. */
export function submitFlagReport(report) {
  return postJSON('/api/flag-report', report, 'Erreur serveur');
}
