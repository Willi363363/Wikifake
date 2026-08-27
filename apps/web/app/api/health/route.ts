// C7.2 — the deployment identity the CI probe reads.
//
// `deploy-check.yml` polls this after a push and compares `commit` to the pushed
// SHA. If this contract changes by one field the loop stops verifying and says
// nothing, which is why the shape lives in `@wikifake/protocol` and the payload
// is encoded through it.
import { healthApi } from '@wikifake/protocol';

import { deploymentIdentity } from '../../../src/deployment.js';
import { logger } from '../../../src/logger.js';
import { json } from '../../../src/respond.js';

/**
 * Never prerendered.
 *
 * This handler reads the environment, and a statically evaluated one would bake
 * in the commit of the machine that built it — so the probe would compare the
 * pushed SHA against a value frozen at build time and, on a rebuild of an old
 * commit, report a match that is not one.
 */
export const dynamic = 'force-dynamic';

export function GET(): Response {
  const identity = deploymentIdentity();
  logger.debug({ commit: identity.commit, version: identity.version }, 'GET /api/health');
  return json(healthApi.healthResponse, identity);
}
