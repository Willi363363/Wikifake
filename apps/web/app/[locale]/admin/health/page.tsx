// The probes — step K.1.
//
// The one section the period does not reach: three probes run when the page
// loads, and a probe has no history to filter. So no `searchParams` to read
// here — and the period bar above says, once for the whole panel, that a live
// probe is live whatever the period. The absence is the honest answer rather
// than a control that would do nothing.
//
// **No redirect, and `requireAdmin` before anything else.** `gate.test.ts`
// walks every page under this tree and holds both.
import type { Metadata } from 'next';

import { requireAdmin } from '../../../../src/admin/gate.js';
import { HealthSection } from '../../../../src/admin/health-screen.js';
import { readHealth } from '../../../../src/admin/health.js';
import { db } from '../../../../src/game/wiring.js';
import { robotsFor } from '../../../../src/indexing.js';

export const metadata: Metadata = { robots: robotsFor('/admin/health') };

/** Never prerendered: it reads a cookie and answers differently per request. */
export const dynamic = 'force-dynamic';

export default async function HealthPage() {
  await requireAdmin();
  const health = await readHealth({
    db: db(),
    // Read here rather than inside: a route is where a real environment is
    // allowed to come from.
    realtimeUrl: process.env['NEXT_PUBLIC_REALTIME_URL'],
  });

  return <HealthSection health={health} />;
}
