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
//
// Step E.3.2 — the heading is the **pseudonym**, read from the `profile` row,
// and no longer `session.user.name`. That column belongs to Better Auth, which
// fills it from a Google profile without asking: on this screen it would have
// shown a player their legal name, under a heading promising it is what other
// players see. An account that has not chosen one yet is sent to the screen
// that asks, by the same gate the game screens use.
import { selectPlayerStats } from '@wikifake/db';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '../../../src/auth/auth.js';
import { CHOOSE_A_NAME, readViewer } from '../../../src/account/gate.js';
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

  // The session is read here as well as inside `readViewer`, and that is one
  // query rather than a duplication worth removing: the email is on this screen
  // and no other, so the viewer — which every game screen builds — has no
  // business carrying an address around.
  const viewer = await readViewer();
  if (viewer.pseudonym === undefined) redirect(CHOOSE_A_NAME);

  const stats = await selectPlayerStats(db(), session.user.id);

  return (
    <Profile pseudonym={viewer.pseudonym} email={session.user.email} stats={stats} />
  );
}
