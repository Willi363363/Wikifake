// One schema per message the server sends.
//
// Four shapes are tightened rather than transcribed, and each closes something
// the current protocol leaves open:
//
//   - `game_start` announces `players` **one** way. The two start paths
//     announce two different shapes today — a list of nicknames on one, objects
//     on the other — and the client has to accept both (D3). One schema makes
//     the divergence unrepresentable.
//   - `hint_unlocked` carries the reveal as one nested object, so a level-1
//     hint cannot ship the truth (C1.2) and a level-2 reveal cannot arrive
//     half-formed.
//   - `scanner_result` carries an explicit `null`. C1.6 says the SCANNER
//     returns null once every fake is found; today the server sends nothing at
//     all, and the client cannot tell exhaustion from a lost frame.
//   - Item messages carry the identifier alone. Name and icon travelled beside
//     it, which is the hand-synchronised duplication of D8; they come from the
//     catalogue of step 1.7.
import { z } from 'zod';

import { articleView, solution } from '../article.js';
import { errorMessage } from '../errors.js';
import { itemId, itemInstance } from '../items.js';
import { scoreBreakdown } from '../score.js';
import {
  falseInfoNumber,
  paragraphIndex,
  playerColour,
  playerName,
  timeLimitSeconds,
  topicLabel,
} from '../primitives.js';

/** One row of the lobby roster. */
const lobbyPlayer = z.object({
  name: playerName,
  colour: playerColour,
  /**
   * D5 — whether their socket is up.
   *
   * The current server never sends this, because it has nothing to send: a
   * disconnection deletes the player, so "away for a moment" and "gone" look
   * identical to everybody else in the room. A player waiting to see whether a
   * rival is coming back has no way to tell.
   */
  connected: z.boolean(),
  ready: z.boolean(),
  answered: z.boolean(),
  /** C1.7 — decided server-side. The client used to infer it, so anyone could start. */
  isHost: z.boolean(),
});

/** The roster, pushed on every arrival, departure, ready flip and submission. */
export const lobbyUpdate = z.object({
  type: z.literal('lobby_update'),
  players: z.array(lobbyPlayer),
});

/** The topic vote is open. */
export const themeVoteStart = z.object({ type: z.literal('theme_vote_start') });

/** Who has voted so far, out of how many connected players. */
export const themeVoteUpdate = z.object({
  type: z.literal('theme_vote_update'),
  submitted: z.array(playerName),
  total: z.number().int().min(0),
});

/**
 * A topic was picked; generation starts.
 *
 * `proposer` is `null` when no ballot decided it and a fallback was used. The
 * current server sends the string "Système" there, which is both a magic value
 * and the last French string on the wire.
 *
 * The old `loading: true` field is gone: it was always true, so it said nothing
 * that the message itself did not already say.
 */
export const themeSelected = z.object({
  type: z.literal('theme_selected'),
  topic: topicLabel,
  proposer: playerName.nullable(),
  /** Every ballot, so the room can see what it voted for. */
  ballots: z.record(playerName, topicLabel),
});

/**
 * C1.1 — the round starts. The article, the count of falsifications, and
 * nothing that identifies them.
 *
 * Flat, like every other message: the payload used to sit nested under `data`,
 * alone among fifteen messages in doing so.
 */
export const gameStart = z.object({
  type: z.literal('game_start'),
  ...articleView.shape,
  players: z.array(z.object({ name: playerName, colour: playerColour })),
  withItems: z.boolean(),
  timeLimit: timeLimitSeconds,
});

/** An opponent's optimistic score during the round. */
export const liveScoreUpdate = z.object({
  type: z.literal('live_score_update'),
  player: playerName,
  score: z.number().int(),
});

/** C5.5 — another player's cursor. Never echoed back to its sender. */
export const cursorUpdate = z.object({
  type: z.literal('cursor_update'),
  player: playerName,
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

/** C5.4 — a chat line, relayed to the whole room. */
export const chatMessage = z.object({
  type: z.literal('chat_message'),
  sender: playerName,
  content: z.string().min(1),
});

/** A wave of items, one per player. `wave` counts waves, not minutes. */
export const itemsDistributed = z.object({
  type: z.literal('items_distributed'),
  wave: z.number().int().min(1),
  items: z.record(playerName, itemInstance),
});

/** An item landed on you, and who sent it. */
export const itemEffect = z.object({
  type: z.literal('item_effect'),
  itemId,
  from: playerName,
});

/** An item was spent, announced to the room. */
export const itemUsed = z.object({
  type: z.literal('item_used'),
  player: playerName,
  itemId,
  targets: z.array(playerName),
});

/**
 * C1.4 — a hint, once paid for.
 *
 * What the level grants is a union on the level itself, not a pair of optional
 * fields: at level 1 there is no truth to read, and at level 2 the truth and
 * the paragraph it sits in arrive together or not at all. Both mistakes stop
 * being runtime checks and become type errors — `grant.truth` does not exist
 * until the client has narrowed on `grant.level === 2`.
 *
 * `charged` is what **this** purchase cost, and 0 when the level was already
 * held. The current server sends the *price of the level* instead, so a client
 * that sums what it was told it paid over-counts every repeat request — and
 * repeat requests are normal, since asking for level 1 after buying level 2
 * returns level 2. `hintPenalty` is the running total computed from server
 * state (C1.3), and the sum of `charged` equals it.
 */
export const hintUnlocked = z.object({
  type: z.literal('hint_unlocked'),
  falseInfoNumber,
  hint: z.string().min(1),
  charged: z.number().int().min(0),
  hintPenalty: z.number().int().min(0),
  grant: z.discriminatedUnion('level', [
    z.object({ level: z.literal(1) }),
    z.object({
      level: z.literal(2),
      truth: z.string().min(1),
      paragraphIndex,
    }),
  ]),
});

/**
 * C1.6 — the SCANNER's answer: a falsified paragraph the player has not found,
 * or `null` once there is none left. Resolved server-side; the client does not
 * know the solution and cannot pick.
 */
export const scannerResult = z.object({
  type: z.literal('scanner_result'),
  paragraphIndex: paragraphIndex.nullable(),
});

/**
 * One final standing. `breakdown` is null for a player who never submitted.
 *
 * The breakdown is the shared one of `score.ts`: solo and multiplayer report a
 * score the same way, or a debrief has to know which mode produced it.
 */
const leaderboardEntry = z.object({
  player: playerName,
  colour: playerColour,
  score: z.number().int(),
  breakdown: scoreBreakdown.nullable(),
});

/**
 * C1.2 — the round is over, and this is the only message that carries the
 * solution. C2.4 — the leaderboard is ordered by descending score, which the
 * ranking rules of step 1.4 produce.
 */
export const gameEnd = z.object({
  type: z.literal('game_end'),
  leaderboard: z.array(leaderboardEntry),
  solution,
});

/** Every message the server may send, the error included. */
export const outgoingMessage = z.discriminatedUnion('type', [
  lobbyUpdate,
  themeVoteStart,
  themeVoteUpdate,
  themeSelected,
  gameStart,
  liveScoreUpdate,
  cursorUpdate,
  chatMessage,
  itemsDistributed,
  itemEffect,
  itemUsed,
  hintUnlocked,
  scannerResult,
  gameEnd,
  errorMessage,
]);
export type OutgoingMessage = z.infer<typeof outgoingMessage>;

/** The outbound catalogue, as data: used by the parity test and the generated doc. */
export const OUTGOING_TYPES = outgoingMessage.options.map(
  (option) => option.shape.type.value,
);

export type LobbyUpdate = z.infer<typeof lobbyUpdate>;
export type ThemeVoteStart = z.infer<typeof themeVoteStart>;
export type ThemeVoteUpdate = z.infer<typeof themeVoteUpdate>;
export type ThemeSelected = z.infer<typeof themeSelected>;
export type GameStart = z.infer<typeof gameStart>;
export type LiveScoreUpdate = z.infer<typeof liveScoreUpdate>;
export type CursorUpdate = z.infer<typeof cursorUpdate>;
export type ChatMessage = z.infer<typeof chatMessage>;
export type ItemsDistributed = z.infer<typeof itemsDistributed>;
export type ItemEffect = z.infer<typeof itemEffect>;
export type ItemUsed = z.infer<typeof itemUsed>;
export type HintUnlocked = z.infer<typeof hintUnlocked>;
export type ScannerResult = z.infer<typeof scannerResult>;
export type GameEnd = z.infer<typeof gameEnd>;

/** Re-exported so both message families read the same way from one namespace. */
export { errorMessage } from '../errors.js';
export type { ErrorMessage } from '../errors.js';
