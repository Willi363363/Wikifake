// `POST /api/view` — step J.4, a page load counted and nothing more.
//
// The whole contract is one closed list. A path would have been the obvious
// field and is the one thing this route must not accept: `/room/ABCD` and
// `/solo?topic=…` carry a room code and a subject somebody typed, and a counter
// keyed by free text is a counter that stores whatever a caller sends it.
import { z } from 'zod';

/**
 * The pages worth counting, which are the two before a round exists.
 *
 * `landing` is the front door and `entry` the screen with the topic field, so
 * the pair answer the one question track I's panel cannot: of the people who arrive,
 * how many get as far as asking for a game. Everything after that is already a
 * row in `game`.
 *
 * Adding a page here is deliberate work — a new value, a mounted component, and
 * a line in the panel — which is the point: a list that grows by itself becomes
 * a log of where everybody went.
 */
export const viewedPage = z.enum(['landing', 'entry']);
export type ViewedPage = z.infer<typeof viewedPage>;

/** What a browser sends. One field, and no room for a second. */
export const recordViewRequest = z.object({ page: viewedPage });
export type RecordViewRequest = z.infer<typeof recordViewRequest>;

/**
 * What it answers.
 *
 * `counted: false` is not an error — a request the route declines to count
 * still succeeded from the browser's point of view, and a beacon has nobody to
 * report a failure to. The field exists so a test can tell the two apart.
 */
export const recordViewResponse = z.object({ counted: z.boolean() });
export type RecordViewResponse = z.infer<typeof recordViewResponse>;
