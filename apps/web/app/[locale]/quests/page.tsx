// `/quests` — step F.7.
//
// The same three answers `/profile` gives, and the middle one is the decision.
// No session is somebody who has not signed in. An **anonymous session is a
// guest**, and a guest is sent to sign up rather than shown quests — not for
// tidiness, but because a quest given to a guest is a quest that disappears:
// `quest_assignment` cascades on `user_id`, and the anonymous plugin deletes
// that row the moment they sign up. `attachGuestRecords` moves the rounds they
// played; nothing moves an assignment, and nothing should — E.3.2 refused to
// spend a *pseudonym* on an identity about to be deleted, and this is the same
// refusal about a promise.
//
// An account with no pseudonym goes where every game screen sends it. Quests
// are not a room, so this is not about a public name: it is that `/choose-a-name`
// is the one screen an account in that state can finish, and offering it
// anything else is offering it a detour.
import type { Metadata } from 'next';

import { robotsFor } from '../../../src/indexing.js';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '../../../src/auth/auth.js';
import { CHOOSE_A_NAME, readViewer } from '../../../src/account/gate.js';
import { db } from '../../../src/game/wiring.js';
import { QuestsScreen } from '../../../src/quests/screen.js';
import { readLiveQuests } from '../../../src/quests/sets.js';

/** Not content, and not a page any crawler should hold: it is one player's. */
export const metadata: Metadata = { robots: robotsFor('/quests') };

/** Never prerendered: it reads a cookie and answers differently per player. */
export const dynamic = 'force-dynamic';

export default async function QuestsPage() {
  const session = await auth().api.getSession({ headers: await headers() });

  if (session === null) redirect('/sign-in');
  if (session.user.isAnonymous === true) redirect('/sign-up');

  const viewer = await readViewer();
  if (viewer.pseudonym === undefined) redirect(CHOOSE_A_NAME);

  // `Date.now()` here rather than inside the read path: the clock is a
  // parameter everywhere in this feature, and a route is where a real one is
  // allowed to come from.
  const quests = await readLiveQuests({ db: db() }, session.user.id, Date.now());

  return <QuestsScreen quests={quests} />;
}
