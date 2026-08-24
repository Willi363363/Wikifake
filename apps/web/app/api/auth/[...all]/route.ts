// `/api/auth/*` — every Better Auth route, mounted once.
//
// The catch-all is Better Auth's own contract: sign-in, sign-up, callbacks,
// session and sign-out all live under this prefix, and enumerating them here
// would be a list to keep in step with a library that owns it.
import { toNextJsHandler } from 'better-auth/next-js';

import { auth } from '../../../../src/auth/auth.js';

/**
 * Never prerendered: every route under here reads cookies and writes them.
 */
export const dynamic = 'force-dynamic';

export const { GET, POST } = toNextJsHandler((request: Request) =>
  auth().handler(request),
);
