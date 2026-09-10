// What a typed rejection answers with.
//
// One table, because three handlers answering `session_not_found` with three
// different statuses is the prose-error problem of C5.1 wearing a numeric hat: a
// client cannot branch on a code whose meaning depends on which route said it.
//
// The union is closed and this table is partial on purpose: a code with no entry
// is a code no REST route has ever returned, and it answers 500 rather than
// getting a number invented for it here.
import { restError, type ErrorCode } from '@wikifake/protocol';

import { json } from '../respond.js';

export const BAD_REQUEST = 400;

const STATUS: Readonly<Partial<Record<ErrorCode, number>>> = {
  /** The body is not JSON, or not a shape the route can read. */
  bad_json: BAD_REQUEST,
  /** The player typed a topic with no article behind it. Ordinary, not broken. */
  topic_not_found: 404,
  /** Wikipedia or the model failed. Upstream, hence 502 rather than 500. */
  generation_failed: 502,
  /**
   * The round is not this caller's, or is over. Deliberately one code for both:
   * telling them apart would answer "does this game exist" to someone who is not
   * in it.
   */
  session_not_found: 404,
  /** A hint asked for by a number the round does not have. */
  hint_not_found: 404,
  /** C1.5 — `HINT_LOCK` is in effect. Refused, and it is the caller's state. */
  hints_blocked: 403,
  /** C5.6 — too many rooms are open. Temporary, hence 503 and not 429. */
  room_capacity_reached: 503,
  /** E.3.2 — a pseudonym another account holds. A conflict, and a lasting one. */
  pseudonym_taken: 409,
  /** E.3.2 — a pseudonym the protocol's own schema refuses. The caller can fix it. */
  invalid_name: BAD_REQUEST,
  /** F.6 — not this account's quest, or nothing at all. One code for both. */
  quest_not_found: 404,
  /** F.6 — the reward is already taken. A conflict, and a lasting one. */
  quest_already_claimed: 409,
  /** F.6 — the target is not met yet. A conflict the player can resolve. */
  quest_not_complete: 409,
  /** H.4 — the coins are not there. 402, the one money-shaped status here. */
  insufficient_coins: 402,
  /** H.4 — coins offered in a room, where the score is what a hint costs. */
  coins_not_accepted: 409,
  /** H.6 — not yours to wear. 403 rather than 404: the refusal is about you. */
  cosmetic_not_owned: 403,
};

export function statusFor(code: ErrorCode): number {
  return STATUS[code] ?? 500;
}

/**
 * A typed rejection, as a response.
 *
 * Every REST failure carries a `code` a client can branch on. FastAPI answers
 * `{"detail": "<a French sentence>"}` today, so a 404 on a hint and a 404 on a
 * session are the same thing to a client — which is why both end up handled as
 * "something went wrong", or not at all.
 */
export function refuse(code: ErrorCode, message: string): Response {
  return json(restError, { code, message }, { status: statusFor(code) });
}
