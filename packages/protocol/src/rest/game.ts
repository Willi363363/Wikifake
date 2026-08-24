// The solo endpoints: `POST /api/game/{start,hint,scan,submit}`.
//
// Solo and multiplayer are the same game played through two transports, so the
// payloads are the same objects. The hint and scan responses are literally the
// WebSocket messages with their `type` removed: writing them out again is how
// the two modes drift, which is the whole reason this package exists.
import { z } from 'zod';

import { articleView, solution } from '../article.js';
import {
  falseInfoNumber,
  hintLevel,
  paragraphIndex,
  timeLimitSeconds,
  topicLabel,
} from '../primitives.js';
import { scoreBreakdown } from '../score.js';
import { hintUnlocked, scannerResult } from '../ws/outgoing.js';

/**
 * A solo session handle. `secrets.token_urlsafe(12)` today: sixteen URL-safe
 * characters. Bounded rather than left as a free string — it is looked up in a
 * registry, and an unbounded key is an unbounded lookup.
 */
export const sessionId = z
  .string()
  .min(16)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'a session id is URL-safe base64');
export type SessionId = z.infer<typeof sessionId>;

/** `POST /api/game/start` — request. */
export const startGameRequest = z.object({
  topic: topicLabel,
  timeLimit: timeLimitSeconds.optional(),
});
export type StartGameRequest = z.infer<typeof startGameRequest>;

/**
 * C1.1 — `POST /api/game/start` — response.
 *
 * The article, the count of falsifications, and a session handle. The shape is
 * `articleView`, the same object the round-start message carries, so the
 * negative assertion holds on both transports by construction rather than
 * twice by hand.
 */
export const startGameResponse = z.object({
  sessionId,
  timeLimit: timeLimitSeconds,
  ...articleView.shape,
});
export type StartGameResponse = z.infer<typeof startGameResponse>;

/** `POST /api/game/hint` — request. Billed server-side (C1.4). */
export const hintRequest = z.object({
  sessionId,
  falseInfoNumber,
  level: hintLevel.default(1),
});
export type HintRequest = z.infer<typeof hintRequest>;

/** `POST /api/game/hint` — response: the `hint_unlocked` message, untyped. */
export const hintResponse = hintUnlocked.omit({ type: true });
export type HintResponse = z.infer<typeof hintResponse>;

/** `POST /api/game/scan` — request. `marked` only avoids pointing twice (C1.6). */
export const scanRequest = z.object({
  sessionId,
  marked: z.array(paragraphIndex).default([]),
});
export type ScanRequest = z.infer<typeof scanRequest>;

/** `POST /api/game/scan` — response: the `scanner_result` message, untyped. */
export const scanResponse = scannerResult.omit({ type: true });
export type ScanResponse = z.infer<typeof scanResponse>;

/**
 * `POST /api/game/submit` — request.
 *
 * The marked paragraphs, and nothing else — same as `submit_answer` over the
 * socket. C1.3: a client-declared penalty is not ignored here, it is unsayable.
 */
export const submitRequest = z.object({
  sessionId,
  marked: z.array(paragraphIndex),
});
export type SubmitRequest = z.infer<typeof submitRequest>;

/**
 * C1.2 — `POST /api/game/submit` — response: the only place the solution
 * appears.
 *
 * The current response also carries a `check` object — `correct_found`,
 * `false_positives`, `missed`, and a percentage also called `score`. Nothing
 * reads it: the debrief recomposes itself from the breakdown and the solution.
 * It is not carried over.
 */
export const submitResponse = z.object({
  score: z.number().int(),
  breakdown: scoreBreakdown,
  solution,
});
export type SubmitResponse = z.infer<typeof submitResponse>;
