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
//
// Step E.3.2 — and it is the gate. This is the one screen every player passes
// through and where signing in lands, so an account that has never chosen a
// pseudonym is caught here rather than at the moment it would have mattered,
// which is halfway into a room. A guest and a stranger go straight through:
// playing without an account is a condition of done, not a degraded mode.
import { requirePseudonym } from '../../../../src/account/gate.js';
import { LobbyEntry } from '../../../../src/lobby/entry.js';

/** Never prerendered: it reads a cookie and answers differently per player. */
export const dynamic = 'force-dynamic';

export default async function PlayPage() {
  const viewer = await requirePseudonym();

  return <LobbyEntry signedIn={viewer.kind === 'account'} />;
}
