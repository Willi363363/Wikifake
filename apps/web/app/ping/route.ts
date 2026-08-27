// C7.1 — `GET /ping` answers exactly `{"status": "alive"}`.
//
// Load balancers read this, and the literal is the contract: `pingResponse` is a
// `z.literal`, so a handler that starts answering "ok" fails its own encoder.
import { healthApi } from '@wikifake/protocol';

import { json } from '../../src/respond.js';

export function GET(): Response {
  return json(healthApi.pingResponse, { status: 'alive' });
}
