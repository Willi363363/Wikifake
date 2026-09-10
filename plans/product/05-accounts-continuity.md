# Track E — guest continuity

The record of **E.6**: what it built, what it only proved, and the one thing
reading Better Auth's source settled that the plan had guessed at.

`05-accounts.md` keeps the step table — the only place that says where a step
stands.

## E.6 — a guest game survives signing up  ✅

**Done when** a guest plays a solo round with no account, is told on the debrief
that signing up keeps it, and the round is on the profile of the account they
create from that invitation — with the round's own numbers, not a count.

### The mechanism was already there, and that is why this step is small

`onLinkAccount` has moved a guest's rows onto their new account since 4.3, and
`attachGuestRecords` has carried the statistics down with them since E.4. It was
proved twice before this step: `apps/web/src/auth/guests.test.ts` drives the
linking through `auth.handler` over a fixture game, and
`multiplayer-profile.spec.ts` walks the whole of it in a browser **for a room**.

So E.6 is not "make it work". It is the two things that were missing around it:
**the ordinary path** — solo, from the entry screen, which is how most
first-time players arrive — and **an invitation**, without which the mechanism
was reachable only by a player who happened to sign up for other reasons.

**Continuity nobody is invited to use is continuity nobody uses.** The only
pointer to an account was E.5's link on the entry screen, which a player passes
*before* they have anything to keep and which says nothing about keeping it. A
guest who closed the tab after a good round lost it — not to a defect, but to a
sentence that had never been written.

### What reading the plugin's source settled

**`onLinkAccount` fires on sign-*in* as well as sign-up.** Its `after` hook
matches every `/sign-in*`, `/sign-up*` and OAuth `/callback*` path that comes
back carrying a session token, so a guest who signs in to an account they
already have keeps the rounds they just played exactly as one who creates a new
account does.

That is what let the invitation promise both in one sentence — *"Sign in to one
you already have and it does the same"* — instead of promising only sign-up and
being quietly wrong about the other half. It was checked in
`plugins/anonymous/index.mjs`, not in the documentation, for the same reason
phase 2 checked `getAuthTables`: the guess would have been reasonable and
untestable from the outside.

### Read from the client's session, and that is a decision

`KeepRound` asks `authClient.useSession()` rather than taking the answer as a
prop. **`/solo` is a prerendered static page** — E.3.2 kept it that way on
purpose — so there is no server component above the debrief to ask, and
threading the answer down would have meant a field on the solo submission *and*
a second one on the room's `game_end`, for a question that is about the
browser's identity rather than about the round.

`anonymousClient()` joins the client's plugins for this: it adds no behaviour
this application calls, only `isAnonymous` on the session user. Without it the
field is in the payload and absent from the type, and the only way to read it is
a cast — which stays compiling on the day the *server* plugin is removed.

### Four session states, and only one is offered anything

- **pending** — nothing. A block that appears after the debrief has settled is a
  block that moves the onward button under the player's cursor.
- **a guest** — the invitation.
- **an account** — nothing. They have already kept it.
- **no session at all** — nothing, and this is the one worth stating. Every
  player who reaches a debrief has an identity: `identify()` mints a guest on
  `POST /api/game/start` and the ticket route does the same for a room. So a null
  session here is a request that did not arrive, and reading it as "no account"
  would tell a signed-in player on a bad connection that a round they own is
  about to be lost.

The comparison is `isAnonymous !== true`, because the type is
`boolean | null | undefined` — Better Auth omits an unset optional field rather
than sending `false`, and `!isAnonymous` would have been right by accident.

### The panel renders it, so no screen can ship without it

Solo and a room each build their own `debrief` object and hand it to `Round`, so
an invitation passed in as a prop would be an invitation a third mode could
forget — and the mode that forgot would be the one whose guests quietly lose
their rounds. It is rendered inside `debrief/panel.tsx` instead, which makes
that unavailable rather than discouraged. The same argument `ReadingSheet` made
in track B, and the same answer.

`debrief.test.tsx` asserts it from inside the panel for exactly that reason:
`keep-round.test.tsx` proves the component chooses correctly, and only the panel
test proves anything ever renders it.

### The journey asserts the round, not a count

`apps/e2e/specs/guest-round.spec.ts` marks **two of the three** paragraphs the
stub falsifies, so the profile afterwards must read *2 found, 1 missed, 0 true
paragraphs marked* — this round's outcome and no other round's. A count of one
is satisfied by any round that reached the database.

**The score is deliberately not the assertion.** It carries a time bonus, so it
is a different number on a loaded machine than on an idle one. The first draft
did assert it and failed on something else entirely, which is worth keeping:
`getByText(/points$/)` resolves to the `<span>` holding the *unit* rather than
the paragraph holding the figure, so the digits came out empty. `solo.spec.ts`
uses the same locator and never noticed, because it only ever waits for it to be
visible.

The second test is the half that would be embarrassing rather than merely
missing: a player who signed up first plays the same round and is told nothing.

## What this step did not do

**E.1's exit line is still a person's.** A guest signing in with *Google* keeps
their round by the same hook — the `/callback*` path is in the matcher — but
nothing here can prove it until the credentials exist. `05-accounts-oauth.md`
has the runbook.
