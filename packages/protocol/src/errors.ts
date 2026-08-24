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
