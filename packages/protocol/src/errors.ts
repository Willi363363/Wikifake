// The closed union of error codes.
//
// C5.1 asks for typed rejections, and the current server half-delivers them:
// six of its errors carry a `code`, three carry only a French sentence. A
// client cannot branch on prose, so those three end up handled as "something
// went wrong" — or not at all. Closing the union is what makes every rejection
// something the client can act on.
//
// The codes stay snake_case: the contract cites them by name.
import { z } from 'zod';

export const ERROR_CODES = [
  /** C5.1 — the room code in the URL matches no open room. */
  'room_not_found',
  /** C5.1 — the nickname is empty, too long, or holds refused characters. */
  'invalid_name',
  /** C5.2 — a connected player already holds that nickname. */
  'name_taken',
  /** C5.3 — the frame was not valid JSON. The connection survives. */
  'bad_json',
  /** C1.7 — a host-only command sent by a guest. The room state is untouched. */
  'not_host',
  /** C1.5 — `HINT_LOCK` is in effect on the buyer. */
  'hints_blocked',
  /**
   * `force_pick` with an empty ballot. Today: "Personne n'a encore proposé de
   * thème", with no code at all.
   */
  'no_theme_submitted',
  /**
   * The requested topic has no usable Wikipedia article. Today: "Mot-clé
   * introuvable", with no code.
   */
  'topic_not_found',
  /**
   * No candidate topic yielded an article, so the round cannot start. Today:
   * "Erreur critique", with no code, and the room silently falls back to
   * waiting.
   */
  'generation_failed',
  /** A solo session that expired or never existed. REST: 404. */
  'session_not_found',
  /** A hint asked for by a number the round does not have. REST: 404. */
  'hint_not_found',
  /** C5.6 — the room registry is full. REST: 503. */
  'room_capacity_reached',
  /**
   * D6 — a `use_item` whose targets make no sense: the caster targeting
   * themselves, the wrong number of them, or the same player twice. Neither
   * validated nor reported today.
   */
  'invalid_target',
  /**
   * A message that makes no sense in the room's current phase — `force_start`
   * during a round, a submission in the lobby.
   *
   * The current server returns early on these, so the client is told nothing and
   * waits for a reply that never comes. A phase guard is a rejection, not a
   * silence.
   */
  'out_of_phase',
  /**
   * A `use_item` naming an instance the player does not hold — already spent, or
   * never theirs. Silently ignored today, so a client that lost track of a hand
   * gets no correction.
   */
  'item_not_held',
  /**
   * E.3.2 — another account already holds that pseudonym. REST: 409.
   *
   * Distinct from `name_taken`, which is C5.2's: *somebody in this room is
   * called that, right now*. This one is permanent and account-wide, and a
   * client that could not tell them apart would offer "try again in a moment"
   * for a name nobody is ever giving back.
   */
  'pseudonym_taken',
  /**
   * F.6 — a quest identifier that is not this account's, or is not anything.
   *
   * One code for both, like `session_not_found`: telling them apart would
   * answer "does this quest exist" about somebody else's row to whoever asked.
   */
  'quest_not_found',
  /**
   * F.6 — the reward has already been taken. REST: 409.
   *
   * The ordinary outcome of a double-clicked button, and the one a client should
   * treat as *success it has already had* rather than as a failure to retry.
   */
  'quest_already_claimed',
  /**
   * F.6 — the target has not been met yet. REST: 409.
   *
   * Distinct from the one above because the two differ in what a player can do:
   * this one becomes claimable by playing, and that one never becomes anything.
   */
  'quest_not_complete',
  /**
   * H.4 — a hint asked for in coins by a player who has not got them. REST: 402.
   *
   * The one status code in this application that is about money, and it is
   * about *earned* coins: nothing here takes a payment. A client shows the
   * balance and the price rather than a retry.
   */
  'insufficient_coins',
  /**
   * H.4 — coins offered for a hint in a room. REST: 409.
   *
   * Solo only, and the reason is the leaderboards: a room round is ranked, and
   * paying with coins leaves the score untouched — so a player with coins would
   * outscore one without. G.5 kept the boards measuring play rather than
   * spending, and this keeps them that way by construction.
   */
  'coins_not_accepted',
] as const;

export const errorCode = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCode>;

/**
 * An error the server sends to one player.
 *
 * `code` is what the client branches on; `message` is what it may show. There
 * is no code-free error: a rejection nobody can branch on is a rejection that
 * gets swallowed.
 */
export const errorMessage = z.object({
  type: z.literal('error'),
  code: errorCode,
  message: z.string().min(1),
});
export type ErrorMessage = z.infer<typeof errorMessage>;

/**
 * The body of a failed REST call.
 *
 * FastAPI answers `{"detail": "<a French sentence>"}` today, so every REST
 * failure is prose too — the same problem the WebSocket errors had, in the one
 * place a client is most likely to want to branch: a 404 on a hint is a
 * different situation from a 404 on the session.
 */
export const restError = z.object({
  code: errorCode,
  message: z.string().min(1),
});
export type RestError = z.infer<typeof restError>;
