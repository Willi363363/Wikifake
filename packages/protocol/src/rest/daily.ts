// The article of the day, over the wire — step N.4.
//
// Only the cron's answer lives here. The *round* on the day's article is
// `startDailyRequest` in `game.ts`, beside the ordinary round it shares a
// response with, because a client that starts one starts the other.
import { z } from 'zod';

/**
 * What a run did, and every field is there to make a log readable.
 *
 * `status` is the outcome of the day itself, and the three are not
 * interchangeable: `ready` means the day has an article — whether this run made
 * it or found it — `generating` means another caller holds the claim, and
 * `unavailable` means nothing could be made and the claim was given back.
 *
 * **`generated` is what makes a second run for the same day legible.** It is
 * false when the day was already there, which is the idempotence N.4 promises
 * shown rather than claimed: a run that made nothing and a run that never
 * happened look different in a log.
 *
 * `reopened` is the count of dead claims swept. Zero every ordinary day, and a
 * number worth noticing on any other.
 */
export const dailyCronResponse = z.object({
  day: z.number().int(),
  status: z.enum(['ready', 'generating', 'unavailable']),
  generated: z.boolean(),
  reopened: z.number().int().nonnegative(),
});
export type DailyCronResponse = z.infer<typeof dailyCronResponse>;
