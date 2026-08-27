// One schema per message a client may send, modelled on the dispatch table of
// `backend/src/realtime/handlers.py`.
//
// Two payload fields are deliberately renamed. `start_game` called its topic
// `category` while `submit_theme` called the same thing `theme` and the round
// payload called it `topic`: three names, one concept. And `unlock_hint` sent a
// field called `number`. Both are now `topic` and `falseInfoNumber` — the
// client is being rewritten alongside, so there is no compatibility to keep.
import { z } from 'zod';

import {
  chatContent,
  cursorCoordinate,
  falseInfoNumber,
  hintLevel,
  paragraphIndex,
  playerName,
  timeLimitSeconds,
  topicLabel,
} from '../primitives.js';

/**
 * Round options, sent by the host with `set_ready`, `force_start` or
 * `start_game`.
 *
 * Both are optional and stay optional: the current server applies each one only
 * when the key is present, which is how a guest's `set_ready` can carry its own
 * `ready` without silently resetting the room's options. C1.7 makes the host
 * check server-side, and step 1.8 owns it — the absence of a key has to survive
 * this far to be a decision the reducer can make.
 */
const roundOptions = {
  withItems: z.boolean().optional(),
  timeLimit: timeLimitSeconds.optional(),
};

/** A player marks themselves ready, and the host may carry the round options. */
export const setReady = z.object({
  type: z.literal('set_ready'),
  ready: z.boolean().default(true),
  ...roundOptions,
});

/** Asks for a fresh roster. Sent on mount, and after a reconnection. */
export const getLobby = z.object({ type: z.literal('get_lobby') });

/** C1.7 — host only: skip the wait and open the topic vote. */
export const forceStart = z.object({
  type: z.literal('force_start'),
  ...roundOptions,
});

/** A player's ballot in the topic vote. */
export const submitTheme = z.object({
  type: z.literal('submit_theme'),
  topic: topicLabel,
});

/** C1.7 — host only: close the vote now and start with what was submitted. */
export const forcePick = z.object({ type: z.literal('force_pick') });

/**
 * C1.7 — host only: start straight on a chosen topic, no vote.
 *
 * The topic is required. The current server accepts the message without one and
 * asks the generator for `None`, which can only fail — a start that cannot
 * start is better refused by the schema.
 */
export const startGame = z.object({
  type: z.literal('start_game'),
  topic: topicLabel,
  ...roundOptions,
});

/**
 * The sender's optimistic score, relayed to the room during the round.
 *
 * Deliberately optimistic: it counts every mark as correct so the solution
 * cannot be read off an opponent's score. Negative values are legitimate
 * (C2.3). The server-side throttle this message still lacks (D6) is transport,
 * and belongs to phase 5.
 */
export const liveScore = z.object({
  type: z.literal('live_score'),
  score: z.number().int(),
});

/** C5.5 — the sender's cursor, clamped on the way in. */
export const cursor = z.object({
  type: z.literal('cursor'),
  x: cursorCoordinate,
  y: cursorCoordinate,
});

/** C5.4 — a chat line for the whole room, sender included. */
export const chatMessage = z.object({
  type: z.literal('chat_message'),
  content: chatContent,
});

/**
 * Spends one item on one or more players.
 *
 * `marked` is what the sender has already ticked, and exists only so SCANNER
 * does not point at a paragraph they already found (C1.6) — marking a paragraph
 * earns nothing by itself.
 *
 * `targets` is validated for shape here and for meaning in step 1.7: no
 * self-targeting, and a bounded count (D6). Until then C5.7 — the 64,000
 * character frame cap — is what bounds the list.
 */
export const useItem = z.object({
  type: z.literal('use_item'),
  instanceId: z.string().min(1),
  targets: z.array(playerName),
  marked: z.array(paragraphIndex).default([]),
});

/**
 * Buys a hint. Level 2 subsumes level 1 and is billed once (C1.4).
 *
 * An out-of-range level is refused rather than rounded down: the current server
 * silently reads any level ≥ 2 as 2, which hides a client bug instead of
 * reporting it.
 */
export const unlockHint = z.object({
  type: z.literal('unlock_hint'),
  falseInfoNumber,
  level: hintLevel.default(1),
});

/** Takes back a submission while the round is still running. */
export const unsubmitAnswer = z.object({ type: z.literal('unsubmit_answer') });

/**
 * Submits the marked paragraphs.
 *
 * Nothing else: `hintsUsed`, `hintPenalty` and `scoreStolen` used to arrive here
 * from the client and were taken at face value — sending zero cleared your
 * penalties. C1.3 makes them server state, and this schema is what makes
 * declaring them impossible rather than merely ignored.
 */
export const submitAnswer = z.object({
  type: z.literal('submit_answer'),
  marked: z.array(paragraphIndex),
});

/** Every message a client may send. C5.3 — an unknown type is ignored, not fatal. */
export const incomingMessage = z.discriminatedUnion('type', [
  setReady,
  getLobby,
  forceStart,
  submitTheme,
  forcePick,
  startGame,
  liveScore,
  cursor,
  chatMessage,
  useItem,
  unlockHint,
  unsubmitAnswer,
  submitAnswer,
]);
export type IncomingMessage = z.infer<typeof incomingMessage>;

/** The dispatch table, as data: used by the parity test and by the generated doc. */
export const INCOMING_TYPES = incomingMessage.options.map(
  (option) => option.shape.type.value,
);

export type SetReady = z.infer<typeof setReady>;
export type GetLobby = z.infer<typeof getLobby>;
export type ForceStart = z.infer<typeof forceStart>;
export type SubmitTheme = z.infer<typeof submitTheme>;
export type ForcePick = z.infer<typeof forcePick>;
export type StartGame = z.infer<typeof startGame>;
export type LiveScore = z.infer<typeof liveScore>;
export type Cursor = z.infer<typeof cursor>;
export type ChatMessage = z.infer<typeof chatMessage>;
export type UseItem = z.infer<typeof useItem>;
export type UnlockHint = z.infer<typeof unlockHint>;
export type UnsubmitAnswer = z.infer<typeof unsubmitAnswer>;
export type SubmitAnswer = z.infer<typeof submitAnswer>;
