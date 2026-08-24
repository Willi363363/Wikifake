// `POST /api/flag-report` — a player reports a **genuine** factual error in an
// article, as opposed to the ones the game injected on purpose.
import { z } from 'zod';

import { playerName, roomCode } from '../primitives.js';

/**
 * The report a player submits.
 *
 * The optional fields keep their defaults rather than becoming required: the
 * form lets a player send a correction without an explanation, and asking for
 * more would reduce the number of reports, which are the point.
 */
export const flagReportRequest = z.object({
  articleTitle: z.string().trim().min(1).max(300),
  articleUrl: z.url().or(z.literal('')).default(''),
  flaggedClaim: z.string().trim().min(1).max(2_000),
  proposedCorrection: z.string().trim().min(1).max(2_000),
  quickNote: z.string().trim().max(500).default(''),
  explanation: z.string().trim().max(2_000).default(''),
  sources: z.array(z.url()).max(10).default([]),
  /** `anonymous` when the player has no account. Accounts arrive in phase 4. */
  playerId: playerName.or(z.literal('anonymous')).default('anonymous'),
  roomCode: roomCode.or(z.literal('')).default(''),
});
export type FlagReportRequest = z.infer<typeof flagReportRequest>;

/**
 * Where a report stands.
 *
 * A closed union, where the current server returns whatever string the promotion
 * logic assigned. The three values are the real ones: reviewed by the model,
 * promoted to a human queue, or rejected.
 */
export const flagStatus = z.enum([
  'ai_reviewed',
  'pending_human_review',
  'rejected_by_ai',
]);
export type FlagStatus = z.infer<typeof flagStatus>;

/**
 * The model's verdict on the report.
 *
 * `verdict` and `recommendation` are closed unions here, and free strings today:
 * they come straight out of a language model through `json.loads`, so nothing
 * checks that the model answered with one of the five values its own prompt
 * lists. A sixth value would flow to the client unnoticed.
 */
export const flagVerification = z.object({
  verdict: z.enum(['likely_valid', 'uncertain', 'unsupported']),
  confidence: z.number().int().min(0).max(100),
  reasoning: z.string().min(1),
  sourcesFound: z.array(z.string().min(1)).max(3),
  recommendation: z.enum(['approve_for_review', 'needs_more_info', 'reject']),
});
export type FlagVerification = z.infer<typeof flagVerification>;

/** `POST /api/flag-report` — response. */
export const flagReportResponse = z.object({
  id: z.string().min(1),
  status: flagStatus,
  verification: flagVerification,
});
export type FlagReportResponse = z.infer<typeof flagReportResponse>;
