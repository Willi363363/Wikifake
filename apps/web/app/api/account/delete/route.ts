// E.7 — `POST /api/account/delete`: the account, and everything that has no
// meaning without it.
//
// `POST` and not `DELETE`, for the reason `sign-out` is a button: this is the
// one irreversible thing a player can do here, and a method a browser, a
// prefetcher or a link-checker might reach for is the wrong one to hang it on.
import { handleDelete } from '../../../../src/account/data.js';
import { accountDataContext } from '../../../../src/account/wiring.js';

/** Reads a cookie and removes rows. Nothing here is prerenderable. */
export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return handleDelete(accountDataContext(), request);
}
