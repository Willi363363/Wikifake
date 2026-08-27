// C4.6 — what a model call cost, as a shape rather than as three shapes.
//
// The producer of these records is `@wikifake/article`, the store is
// `@wikifake/db`, and the reader is `GET /api/usage`. Declared once here because
// three copies of "what a call was for" and "what a call cost" is exactly D8:
// the enum in the database, the key of `byKind` on the endpoint, and whatever the
// generator labels its own calls all have to be the same list, and only one of
// them gets to be the list.
import { z } from 'zod';

/**
 * What the call was for.
 *
 * `topic_choice` and `falsification` are the two `usage.py` records today.
 * `flag_verification` is a third: `flag_verifier.py` calls the model and records
 * nothing, so the cost of verifying a player's report is invisible (D12).
 */
export const llmCallKind = z.enum(['topic_choice', 'falsification', 'flag_verification']);
export type LlmCallKind = z.infer<typeof llmCallKind>;

/**
 * One call to the model, as it happened.
 *
 * `inputTokens` and `outputTokens` are **nullable** rather than zero-by-default:
 * a provider that reports no usage has told us nothing, and a zero there reads
 * like a measurement. The character counts are the proxy `usage.py` already falls
 * back on, and they are always known — including for a call that failed, which is
 * why `promptChars` is required and `outputChars` is not optional but zero.
 *
 * C4.5 — a failure is recorded as one. It bought nothing, so it is counted as
 * nothing else; `failed` is what keeps it out of `perGeneratedGame`.
 *
 * No `gameId`: a call is made before there is a game to attach it to, and a
 * failed one never gets a game at all. Whoever persists the call knows the game.
 */
export const llmCallRecord = z.object({
  /** The model that was actually used, not the one that was configured. */
  model: z.string().min(1),
  kind: llmCallKind,
  inputTokens: z.number().int().min(0).nullable(),
  outputTokens: z.number().int().min(0).nullable(),
  promptChars: z.number().int().min(0),
  outputChars: z.number().int().min(0),
  failed: z.boolean(),
});
export type LlmCallRecord = z.infer<typeof llmCallRecord>;
