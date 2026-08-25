// Which round is this, and is the caller in it.
//
// The session handle a client sends is the game's own identifier, and it is not
// a secret. What decides whether the caller may buy a hint is whether they have
// a `participant` row in that game — which comes from their session cookie, not
// from anything they typed. That is the difference from the current
// `secrets.token_urlsafe(12)`: a token in a dictionary is an authorisation
// anybody who sees it inherits, and a restart empties the dictionary anyway.
import { selectParticipantFor, selectRoundStatus, type Database } from '@wikifake/db';
import type { ErrorCode } from '@wikifake/protocol';

import type { auth } from '../auth/auth.js';

export interface SessionContext {
  readonly auth: ReturnType<typeof auth>;
  readonly db: Database['db'];
}

/**
 * The round, and the caller's place in it.
 *
 * Descriptive, not normative: whether a round that is over may still be acted on
 * is a question each route answers differently — a hint cannot be bought after
 * the end, and a submission that already happened must still be able to hand
 * back its debrief. Deciding it here would force one of the two to work around
 * the other.
 */
export interface Round {
  readonly gameId: string;
  readonly participantId: string;
  readonly timeLimit: number;
  readonly startedAt: Date;
  /** Null while the round is still running. */
  readonly endedAt: Date | null;
  /** Null until this player has submitted. */
  readonly submittedAt: Date | null;
}

export type RoundAccess =
  | { readonly ok: true; readonly round: Round }
  | { readonly ok: false; readonly code: ErrorCode; readonly message: string };

/**
 * One refusal for every way this can fail.
 *
 * No session, a game that does not exist, a game that is somebody else's: all
 * `session_not_found`. Telling them apart would answer "does this game exist" —
 * and, worse, "is this the right identifier" — to someone who has no business in
 * the round. The routes that also refuse a finished round answer with the same
 * code, for the same reason.
 */
export const REFUSED = {
  ok: false,
  code: 'session_not_found',
  message: 'This session does not exist, or is over.',
} as const;

/**
 * The shape a game identifier has, checked before it reaches Postgres.
 *
 * `sessionId` in the contract is any URL-safe string of 16 to 64 characters —
 * it was written for `secrets.token_urlsafe(12)`, and step 4.4 made the handle
 * the game's own uuid instead. Handing Postgres a well-formed handle that is not
 * a uuid raises a syntax error, so the refusal would arrive as a 500 rather than
 * as the 404 it is. Narrowing the contract itself is a protocol decision and
 * belongs to a step that owns the protocol.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The round this request is about, if the caller is entitled to it. */
export async function openRound(
  context: SessionContext,
  sessionId: string,
  request: Request,
): Promise<RoundAccess> {
  const session = await context.auth.api.getSession({ headers: request.headers });
  // No identity, no participation. Unlike `/api/game/start`, nothing is minted
  // here: a guest created on this request could not be in a round that started
  // before it.
  if (session === null) return REFUSED;
  if (!UUID.test(sessionId)) return REFUSED;

  const [round] = await selectRoundStatus(context.db, sessionId);
  if (round === undefined) return REFUSED;

  const [player] = await selectParticipantFor(context.db, sessionId, session.user.id);
  if (player === undefined) return REFUSED;

  return {
    ok: true,
    round: {
      gameId: round.id,
      participantId: player.id,
      timeLimit: round.timeLimit,
      startedAt: round.startedAt,
      endedAt: round.endedAt,
      submittedAt: player.submittedAt,
    },
  };
}
