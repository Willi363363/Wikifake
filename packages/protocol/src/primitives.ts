// The values that appear in more than one message, defined once.
//
// Two conventions hold across the whole protocol, and they differ on purpose:
//
//   - **Message types and error codes stay snake_case.** They are identifiers
//     the contract cites by name — `not_host`, `hints_blocked`, `submit_answer`
//     — and renaming them would silently break every reference in
//     `plans/rewrite/01-contract-to-preserve.md`.
//   - **Field names are camelCase.** Today's protocol mixes the two, sometimes
//     inside one message: `lobby_update` sends `isHost`, and a scoring
//     breakdown sends `timeBonus` beside `hint_penalty`. Since both ends of the
//     new stack are TypeScript and both are being rewritten, there is no
//     compatibility to keep — only a convention to stop guessing at.
import { z } from 'zod';

/** C5.1 — nickname length, mirrored from `MAX_PLAYER_NAME_LENGTH`. */
export const MAX_PLAYER_NAME_LENGTH = 24;
/** C5.4 — chat cap, mirrored from `MAX_CHAT_LENGTH`. */
export const MAX_CHAT_LENGTH = 400;
/** C5.6 — room codes are six characters. */
export const ROOM_CODE_LENGTH = 6;
/** Round length bounds, the ones the current picker already offers. */
export const MIN_TIME_LIMIT_SECONDS = 30;
export const MAX_TIME_LIMIT_SECONDS = 600;
/** Default round length when nobody picks one. */
export const DEFAULT_TIME_LIMIT_SECONDS = 300;

/**
 * C5.5 — how often a socket may send the two messages that change nothing.
 *
 * Here rather than in the service, because both ends need the same number: the
 * server refuses anything faster, and a client pacing itself faster than that
 * is a client whose extra messages are dropped. Two copies of a floor is one
 * copy of a floor and one copy of a bug.
 *
 * `cursor`: twenty-five a second, the value the current server ships.
 * `live_score`: five a second — the message is the sender's own tally, and a
 * human does not tick five paragraphs in a second.
 */
export const CURSOR_MIN_INTERVAL_MS = 40;
export const LIVE_SCORE_MIN_INTERVAL_MS = 200;

/**
 * C5.1 — a nickname: trimmed, non-empty, at most 24 characters, and drawn from
 * letters, digits, hyphen, dot, underscore and space.
 *
 * The nickname is a dictionary key and travels in the WebSocket URL, so it is
 * validated before it becomes either.
 *
 * The character class is spelled out in Unicode properties rather than as
 * `\w`, because the two languages disagree on what `\w` means: Python's
 * `re.UNICODE` — what `validate_player_name` uses today — accepts `élise`,
 * while JavaScript's `\w` is ASCII-only and would refuse it. Transcribing the
 * regex literally would have quietly locked out every accented nickname.
 */
export const playerName = z
  .string()
  .trim()
  .min(1, 'a nickname cannot be empty')
  .max(
    MAX_PLAYER_NAME_LENGTH,
    `a nickname is at most ${MAX_PLAYER_NAME_LENGTH} characters`,
  )
  .regex(
    /^[\p{L}\p{N}_\-. ]+$/u,
    'a nickname holds letters, digits, hyphen, dot, underscore and space',
  );
export type PlayerName = z.infer<typeof playerName>;

/** C5.6 — a room code: six upper-case letters or digits. */
export const roomCode = z
  .string()
  .length(ROOM_CODE_LENGTH)
  .regex(/^[A-Z0-9]+$/, 'a room code is upper-case letters and digits');
export type RoomCode = z.infer<typeof roomCode>;

/** The colour the server assigns to a player, as a hex triplet. */
export const playerColour = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'expected a #rrggbb colour');
export type PlayerColour = z.infer<typeof playerColour>;

/**
 * C3.3 — a paragraph index, **1-based**. The client sends the number it clicked
 * on, and 0 is not a paragraph: making it unrepresentable here is what keeps an
 * off-by-one from being graded rather than rejected.
 */
export const paragraphIndex = z.number().int().min(1);
export type ParagraphIndex = z.infer<typeof paragraphIndex>;

/** C3.3 — `falseInfoNumber` runs from 1 to n. */
export const falseInfoNumber = z.number().int().min(1);
export type FalseInfoNumber = z.infer<typeof falseInfoNumber>;

/** C1.4 — hints have two levels, and level 2 subsumes level 1. */
export const hintLevel = z.union([z.literal(1), z.literal(2)]);
export type HintLevel = z.infer<typeof hintLevel>;

/** C5.4 — chat content: trimmed and capped. An empty message is dropped, not sent. */
export const chatContent = z.string().trim().min(1).max(MAX_CHAT_LENGTH);
export type ChatContent = z.infer<typeof chatContent>;

/**
 * A round length, in seconds, inside the bounds the picker already offers.
 *
 * The current server takes whatever integer the host sends, and the time bonus
 * is `max(0, timeLimit − elapsed) × 0.5` (C2.1): an unbounded `timeLimit` is an
 * unbounded score. Refusing it **mid-round** is a rule and belongs to step 1.8;
 * refusing an absurd value at all is transport, and belongs here.
 */
export const timeLimitSeconds = z
  .number()
  .int()
  .min(MIN_TIME_LIMIT_SECONDS)
  .max(MAX_TIME_LIMIT_SECONDS);
export type TimeLimitSeconds = z.infer<typeof timeLimitSeconds>;

/**
 * C5.5 — a cursor coordinate, clamped rather than refused.
 *
 * A cursor outside `[0,1]` is a rounding artefact or a resized window, not an
 * attack: the current server clamps it, and a player must not lose their
 * connection over a stray pixel. Anything that is not a number at all becomes
 * 0 — the same tolerance, expressed in the schema instead of in a handler.
 */
export const cursorCoordinate = z
  .unknown()
  .transform((value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0))
  .transform((value) => Math.max(0, Math.min(1, value)))
  // A transform has no JSON Schema, so the generated documentation would say
  // `unknown` about the one field whose tolerance is the interesting part.
  .describe('number clamped to [0,1]; anything else becomes 0');
export type CursorCoordinate = z.infer<typeof cursorCoordinate>;

/**
 * A topic a player types into the vote. Trimmed and non-empty — the current
 * server drops a blank vote silently.
 *
 * Wikipedia topics are the one thing here that stays French: this is data read
 * from `fr.wikipedia.org`, not prose of ours.
 */
export const topicLabel = z.string().trim().min(1).max(120);
export type TopicLabel = z.infer<typeof topicLabel>;
