// The quest cron's contract — step F.5.
//
// One route, and no client. `GET /api/cron/quests` is called by Vercel's
// scheduler and by nobody else, so this schema exists for two readers rather
// than for a browser: the parity test of C8.1, which refuses a route the
// catalogue does not describe, and the generated documentation.
//
// Its refusals deliberately carry no schema. `restError` is the shape a *client*
// branches on, and there is no client here — the scheduler reads a status code
// and a log reads the rest.
import { z } from 'zod';

/**
 * What a run did, and the second number is the interesting one.
 *
 * `assigned` is `0` on a second run for the same day, which is what makes the
 * idempotence F.5 promises visible in a log rather than merely claimed. A run
 * that assigned nothing and a run that never happened look different.
 */
export const questCronResponse = z.object({
  players: z.number().int().nonnegative(),
  assigned: z.number().int().nonnegative(),
});
export type QuestCronResponse = z.infer<typeof questCronResponse>;

/**
 * F.6 — `POST /api/quests/claim`.
 *
 * The identifier and nothing else. **Not the rule, the period or the target**:
 * every one of those is already on the row the identifier names, and a body that
 * repeated them would be a body the server has to either check or ignore. A
 * `uuid` because that is what `quest_assignment.id` is, checked here so a
 * malformed one is a 400 rather than a Postgres syntax error arriving as a 500 —
 * the same trap `session.ts` documents for a game handle.
 */
export const claimQuestRequest = z.object({ questId: z.string().uuid() });
export type ClaimQuestRequest = z.infer<typeof claimQuestRequest>;

/**
 * What was claimed, and what it paid.
 *
 * `reward` is echoed back rather than left for the client to look up: the
 * catalogue is the server's, a screen that computed the figure itself would be a
 * second copy of it, and the number a player is told they earned should be the
 * number the server decided.
 *
 * There is no balance in it, because there is no wallet — track H owns that, and
 * F.6 was re-cut to the once-only marking. When a balance exists this response
 * gains a field; nothing about the claim changes.
 */
export const claimQuestResponse = z.object({
  questId: z.string().uuid(),
  ruleId: z.string().min(1),
  reward: z.number().int().positive(),
  claimedAt: z.string().datetime(),
});
export type ClaimQuestResponse = z.infer<typeof claimQuestResponse>;
