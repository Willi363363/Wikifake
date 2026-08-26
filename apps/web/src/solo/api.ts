// The two calls the solo journey makes, and what they are allowed to return.
//
// Both responses are decoded against the schema the route encodes with, so a
// server that answers something else is caught here rather than three renders
// later as `undefined is not a function`. That is not defensiveness for its own
// sake: `POST /api/game/start` is the one payload in the game that must **not**
// carry the solution (C1.1), and a client that reads the fields it happens to
// find would keep working if a field it should never see appeared.
//
// A refusal is a message, not a status code. The routes answer with `restError`,
// whose `message` is a sentence a player can act on — "no article found for that
// topic" rather than 404. The entry screen of 7.2 reads that field by hand with a
// cast; here it is decoded, which is the same fix applied one layer down.
import { decode, gameApi, restError } from '@wikifake/protocol';

/** What the server said, or why it could not be believed. */
export type Answer<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

const UNREACHABLE = 'the server could not be reached';
const UNREADABLE = 'the server answered something we cannot read';
const REFUSED = 'the server refused the request';

/** A POST, its body, and the refusal path. Never throws. */
async function post(path: string, body: unknown): Promise<Answer<unknown>> {
  let answer: Response;
  try {
    answer = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: UNREACHABLE };
  }

  // Read before the status is looked at: a refusal carries its reason in the
  // same body a success would have used.
  let payload: unknown = null;
  try {
    payload = await answer.json();
  } catch {
    payload = null;
  }

  if (!answer.ok) {
    const said = decode(restError, payload);
    return { ok: false, message: said.ok ? said.value.message : REFUSED };
  }
  return { ok: true, value: payload };
}

/** C1.1 — the article, how many paragraphs were altered, and a session handle. */
export async function startRound(
  request: gameApi.StartGameRequest,
): Promise<Answer<gameApi.StartGameResponse>> {
  const answered = await post('/api/game/start', request);
  if (!answered.ok) return answered;

  const read = decode(gameApi.startGameResponse, answered.value);
  return read.ok ? { ok: true, value: read.value } : { ok: false, message: UNREADABLE };
}

/** C1.2 — the marked paragraphs go up, the score and the solution come back. */
export async function submitRound(
  request: gameApi.SubmitRequest,
): Promise<Answer<gameApi.SubmitResponse>> {
  const answered = await post('/api/game/submit', request);
  if (!answered.ok) return answered;

  const read = decode(gameApi.submitResponse, answered.value);
  return read.ok ? { ok: true, value: read.value } : { ok: false, message: UNREADABLE };
}
