// The funnel — step K.1.
//
// One section, one address. The body is what track I already drew; K.5
// replaces it with the shape the owner chose, and this step is the move.
//
// **No redirect, and `requireAdmin` before anything else.** `gate.test.ts`
// walks every page under this tree and holds both: a 404 is the answer, and
// the fact the page exists is the thing being withheld.
import type { Metadata } from 'next';

import { rangeAsked, type AskedFor } from '../../../../src/admin/asked-range.js';
import { requireAdmin } from '../../../../src/admin/gate.js';
import { ActivationSection } from '../../../../src/admin/activation-screen.js';
import { readActivation } from '../../../../src/admin/activation.js';
import { db } from '../../../../src/game/wiring.js';
import { robotsFor } from '../../../../src/indexing.js';

export const metadata: Metadata = { robots: robotsFor('/admin/activation') };

/** Never prerendered: it reads a cookie and answers differently per request. */
export const dynamic = 'force-dynamic';

export default async function ActivationPage({
  searchParams,
}: {
  readonly searchParams: AskedFor;
}) {
  await requireAdmin();
  const range = await rangeAsked(searchParams);
  const view = await readActivation({ db: db() }, range);

  return <ActivationSection activation={view} />;
}
