// C4.6 — `GET /api/usage`: what a game costs.
import { handleUsage } from '../../../src/game/usage.js';
import { usageContext } from '../../../src/game/wiring.js';

/**
 * Never prerendered.
 *
 * It reports counters that change with every game. A statically evaluated
 * handler would bake in whatever the build machine's database happened to say —
 * which, for a build machine, is nothing at all.
 */
export const dynamic = 'force-dynamic';

export function GET(): Promise<Response> {
  return handleUsage(usageContext());
}
