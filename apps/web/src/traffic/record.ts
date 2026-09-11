// Step J.4 — the handler behind `POST /api/view`.
//
// **What it does not do is the design.** It reads no cookie, no session and no
// IP; it writes no row that names anybody; it answers the same thing to
// everybody. There is nothing here to authorise, because there is nothing here
// that could be about one person.
//
// The price is stated rather than hidden: with no identifier there is no way to
// tell one person loading the landing twice from two people loading it once, and
// no way to stop somebody sending the request by hand. **This counts page loads
// that ran our JavaScript, and it is not audit-grade.** `10-seo-analytics.md`
// argues why that is the right trade for a game with no advertising to sell.
import { recordPageView, type Database } from '@wikifake/db';
import { recordViewRequest, recordViewResponse } from '@wikifake/protocol';

import { json } from '../respond.js';

export interface TrafficContext {
  readonly db: Database['db'];
  /** The clock, injected like everywhere else that measures a day. */
  readonly now: () => Date;
}

/**
 * Whether the request came from a page we served.
 *
 * The `Origin` header against the host the request actually arrived at — not
 * against a configured URL, which would be one more thing to get wrong per
 * environment and would have broken on every preview deployment.
 *
 * **A filter, not a boundary.** A forged header passes it; a crawler, a stray
 * `curl` and somebody else's page embedding this route do not. That is the
 * whole ambition: keep accidents out of a counter, and do not pretend a public
 * endpoint with no identifier can be defended.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (origin === null) return false;
  return origin === new URL(request.url).origin;
}

export async function handleRecordView(
  context: TrafficContext,
  request: Request,
): Promise<Response> {
  // 200 and `counted: false` rather than a refusal. A beacon is fired into the
  // void by a page that may already be unloading: there is nobody to read a 403,
  // and an error status would fill a browser console on a page nothing is wrong
  // with.
  if (!sameOrigin(request)) return json(recordViewResponse, { counted: false });

  const body: unknown = await request.json().catch(() => null);
  const asked = recordViewRequest.safeParse(body);
  if (!asked.success) return json(recordViewResponse, { counted: false });

  await recordPageView(context.db, asked.data.page, context.now());
  return json(recordViewResponse, { counted: true });
}
