// The entry screen.
//
// Inside the `(game)` group on purpose: the provider of 7.1 is already mounted
// here, idle because there is no room yet. Opening or joining one is then a
// navigation *within* the group, so the socket opens once, where it would
// otherwise open, close and reopen across the transition.
//
// Step E.5 — it also decides whether there is an account behind this browser.
// Read here rather than in the screen: a client component would have to ask
// over the network and the link would flicker from "Create an account" to
// "Your profile" after hydration. An **anonymous** session is a guest, and a
// guest is offered the account rather than the profile they do not have.
import { headers } from 'next/headers';

import { auth } from '../../../../src/auth/auth.js';
import { LobbyEntry } from '../../../../src/lobby/entry.js';

export default async function PlayPage() {
  const session = await auth().api.getSession({ headers: await headers() });
  const signedIn = session !== null && session.user.isAnonymous !== true;

  return <LobbyEntry signedIn={signedIn} />;
}
