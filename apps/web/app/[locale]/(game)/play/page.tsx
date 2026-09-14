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
//
// Step E.3.3 — the pseudonym travels down with it, so the screen tells a
// signed-in player what they will be called instead of asking. The guarantee
// itself is the ticket route's; this is what keeps the screen honest about it.
import { requirePseudonym } from '../../../../src/account/gate.js';
import { db } from '../../../../src/game/wiring.js';
import { Dashboard } from '../../../../src/lobby/dashboard.js';
import { readHome } from '../../../../src/lobby/home.js';
import { PageView } from '../../../../src/traffic/page-view.js';

/** Never prerendered: it reads a cookie and answers differently per player. */
export const dynamic = 'force-dynamic';

export default async function PlayPage() {
  const viewer = await requirePseudonym();

  // L.6 — the four reads the dashboard draws, composed in one place. The clock
  // is a parameter everywhere in this codebase and a route is where a real one
  // is allowed to come from, which is why `Date.now()` is here and not inside.
  //
  // A guest gets a board and nothing else: `readHome` is handed no identity, so
  // there is no query keyed by one. That is the same shape as the null it
  // returns — an absence rather than a row of zeroes.
  const home = await readHome(
    { db: db() },
    viewer.kind === 'account' ? (viewer.userId ?? null) : null,
    Date.now(),
  );

  return (
    <>
      <Dashboard
        home={home}
        signedIn={viewer.kind === 'account'}
        {...(viewer.pseudonym === undefined ? {} : { pseudonym: viewer.pseudonym })}
      />
      {/* Step J.4 — the second half of the one funnel the admin panel cannot
          see: of the people who arrive, how many reach the screen with the
          topic field. Everything after this is already a row in `game`. */}
      <PageView page="entry" />
    </>
  );
}
