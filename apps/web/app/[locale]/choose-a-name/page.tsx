// `/choose-a-name` — step E.3.2.
//
// The screen every account that arrived through Google lands on, and the one
// sign-up sends a player to when its own claim lost a race. Outside the
// `(game)` route group for the reason `/sign-in` is: that group's layout mounts
// the socket provider, and there is no room to connect to.
//
// Three answers, and the middle one is again the decision. **No session** is
// somebody who has not signed in, and they are sent to sign up — there is no
// account here to name. **A guest** is sent to the same place, because a guest's
// `user` row is deleted by the anonymous plugin the moment they sign up, and a
// pseudonym spent on it would be held by nobody and released by nothing. **An
// account that already has one** has no business on this screen and is sent to
// its profile, so that a bookmark cannot be used to look at a form that would
// only ever refuse.
import type { Metadata } from 'next';

import { robotsFor } from '../../../src/indexing.js';
import { redirect } from 'next/navigation';

import { PseudonymScreen } from '../../../src/account/pseudonym-screen.js';
import { readViewer } from '../../../src/account/gate.js';

/** Not content: it is one account's missing field. */
export const metadata: Metadata = { robots: robotsFor('/choose-a-name') };

/** Never prerendered: it reads a cookie and answers differently per player. */
export const dynamic = 'force-dynamic';

export default async function ChooseANamePage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await readViewer();

  if (viewer.kind !== 'account') redirect('/sign-up');
  if (viewer.pseudonym !== undefined) redirect('/profile');

  // What sign-up was refused, echoed back into the field. A string only: a
  // repeated query parameter arrives as an array, and there is one name.
  const attempted = (await searchParams)['attempted'];

  return <PseudonymScreen {...(typeof attempted === 'string' ? { attempted } : {})} />;
}
