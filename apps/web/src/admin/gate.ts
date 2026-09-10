// Who reaches the panel, and what everybody else is told — step I.1.
//
// **404 and not 403**, which is the plan's own decision: *"an admin route that
// announces itself is a target, and there is no reason to confirm it exists."*
// A 403 tells a stranger they have found the right address and only lack the
// right account, which is the half of the answer worth having; a 404 tells them
// nothing they did not know before asking.
//
// The same reasoning `openRound` gives about `session_not_found`: no session, no
// account and not-an-admin all get the identical answer, because the difference
// is only useful to somebody who has no business here.
//
// **One function, and every admin page calls it first.** A gate that some pages
// remembered to call is a gate, and one that all of them call is a rule —
// `gate.test.ts` reads the route files and fails if a page under `admin/` does
// not begin with it.
import { isAdmin } from '@wikifake/db';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { auth } from '../auth/auth.js';
import { db } from '../game/wiring.js';

export interface Admin {
  readonly userId: string;
}

/**
 * The admin behind this request, or a 404 for everybody else.
 *
 * It throws rather than returning a refusal, because `notFound()` is how Next
 * says 404 from a server component and there is no rendering left to do after
 * it. A boolean would be a boolean somebody forgets to branch on.
 *
 * A guest is refused with the same 404 as a stranger. It is not that a guest
 * could never be an admin — `admin.user_id` would happily hold one — it is that
 * the anonymous plugin deletes that row when they sign up, so an admin guest is
 * an admin who disappears. Nobody should grant one.
 */
export async function requireAdmin(): Promise<Admin> {
  const session = await auth().api.getSession({ headers: await headers() });

  if (session === null) notFound();
  if (session.user.isAnonymous === true) notFound();
  if (!(await isAdmin(db(), session.user.id))) notFound();

  return { userId: session.user.id };
}
