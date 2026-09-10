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
