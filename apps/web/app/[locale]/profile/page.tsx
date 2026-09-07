// `/profile` — step E.5.
//
// The session is read here, on the server, and the row is read with the id it
// carries. There is no route that takes a user id as a parameter, deliberately:
// the only history this application will serve is the one belonging to whoever
// is asking, so there is nothing to get an authorisation check wrong on.
//
// Three answers, and the second is the one worth naming. No session at all is
// somebody who has not signed in, and they are sent to sign in. An **anonymous**
// session is a guest — a real `user` row, created so the games they play can
// follow them into an account — and a guest has no profile to show: they are
// sent to sign up, which is the screen that turns what they have already played
// into something with a name on it.
import { selectPlayerStats } from '@wikifake/db';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '../../../src/auth/auth.js';
import { db } from '../../../src/game/wiring.js';
import { Profile } from '../../../src/account/profile.js';

/** Not content, and not a page any crawler should hold: it is one player's. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Never prerendered: it reads a cookie and answers differently per player. */
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const session = await auth().api.getSession({ headers: await headers() });

  if (session === null) redirect('/sign-in');
  if (session.user.isAnonymous === true) redirect('/sign-up');

  const stats = await selectPlayerStats(db(), session.user.id);

  return (
    <Profile pseudonym={session.user.name} email={session.user.email} stats={stats} />
  );
}
