// What the model has cost — step K.1.
//
// One section, one address. The body is what track I already drew; K.9
// replaces it with the shape the owner chose, and this step is the move.
//
// **No redirect, and `requireAdmin` before anything else.** `gate.test.ts`
// walks every page under this tree and holds both.
import type { Metadata } from 'next';

import { rangeAsked, type AskedFor } from '../../../../src/admin/asked-range.js';
import { CostSection } from '../../../../src/admin/cost-screen.js';
import { rateFrom, readCost } from '../../../../src/admin/cost.js';
import { requireAdmin } from '../../../../src/admin/gate.js';
import { db } from '../../../../src/game/wiring.js';
import { robotsFor } from '../../../../src/indexing.js';

export const metadata: Metadata = { robots: robotsFor('/admin/cost') };

/** Never prerendered: it reads a cookie and answers differently per request. */
export const dynamic = 'force-dynamic';

export default async function CostPage({
  searchParams,
}: {
  readonly searchParams: AskedFor;
}) {
  await requireAdmin();
  const range = await rangeAsked(searchParams);
  const cost = await readCost(
    {
      db: db(),
      // Read here rather than inside: a route is where a real environment is
      // allowed to come from. No rate lives in this repository — one written
      // here is wrong within a quarter and silent about it.
      inputCostPerMTok: rateFrom(process.env['MODEL_INPUT_COST_PER_MTOK']),
      outputCostPerMTok: rateFrom(process.env['MODEL_OUTPUT_COST_PER_MTOK']),
    },
    range,
  );

  return <CostSection cost={cost} />;
}
