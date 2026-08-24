// What a player is shown, and what the server keeps to itself.
//
// The split between the two schemas below is C1.1 and C1.2 expressed as types:
// `articleView` is everything the round may know, `falsifiedPosition` is the
// solution. They never travel in the same message, and the round-start payload
// cannot carry the second one — Zod strips what a schema does not declare, so a
// position accidentally spread into a start payload disappears on encoding
// rather than reaching a DevTools console.
import { z } from 'zod';

import { falseInfoNumber, paragraphIndex, topicLabel } from './primitives.js';

/**
 * C1.1 — the article as the round sees it: the falsified paragraphs, and the
 * **count** of falsifications. Never which ones, never the explanations, never
 * the hints, never `originalText` — a diff was enough to solve the game.
 */
export const articleView = z.object({
  topic: topicLabel,
  paragraphs: z.array(z.string()).min(1),
  /** How many paragraphs were falsified. The only thing said about them. */
  totalFakes: z.number().int().min(1),
  /** C6.1 — the source link, part of the CC BY-SA attribution. */
  wikipediaUrl: z.url(),
});
export type ArticleView = z.infer<typeof articleView>;

/**
 * C1.2 — one falsification, revealed with `game_end` and never before.
 *
 * `falseStatement` is the text the player read, `explanation` is the truth. The
 * shape rules — indices sorted ascending, numbers sequential from 1 — are
 * properties of the **set** of positions and are enforced by the grading rules
 * of step 1.6; what a single position looks like is here.
 */
export const falsifiedPosition = z.object({
  paragraphIndex,
  falseInfoNumber,
  falseStatement: z.string().min(1),
  explanation: z.string().min(1),
  hint: z.string().min(1),
});
export type FalsifiedPosition = z.infer<typeof falsifiedPosition>;

/** The complete solution, as it leaves with `game_end`. */
export const solution = z.array(falsifiedPosition).min(1);
export type Solution = z.infer<typeof solution>;
