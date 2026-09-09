# Track E — choosing a pseudonym, and showing it

The record of **E.3.2 and E.3.3**: how an account comes to have the pseudonym
E.3.1 made unique, and where that name is then the only thing another player
sees.

`05-accounts.md` keeps the step table — the only place that says where a step
stands — and `05-accounts-pseudonym.md` carries the re-cut of E.3 and the data
rule those two steps rest on.

## E.3.2 — every account chooses one  ✅

**Done when** an account cannot reach the game without a pseudonym, whichever
way it was created, and a taken one is refused with a sentence rather than a
stack trace.

### The invariant, and it is the whole step

**A `profile` row is a pseudonym that has been chosen.** Its absence is what
marks an account that has not chosen — and that state is legitimate, not an
error: it is where every account created through Google begins, and where an
account whose sign-up claim lost a race ends up. One screen resolves it, and one
gate sends people to that screen.

Stating it that way is what made the step small. The alternative was to make
sign-up atomic — no account without a pseudonym, ever — and that is not
available: Better Auth owns the `user` insert, and the row holding the pseudonym
needs the account's id, so the two cannot be one statement. Every design that
pretends otherwise is a `databaseHooks` arrangement that half works, and the
half that fails leaves an account nobody can name.

### One endpoint, called by two screens

`POST /api/account/pseudonym` is the only thing that creates a `profile` row.
Sign-up calls it the moment the account exists; `/choose-a-name` calls it for
everybody else. A claim wired into sign-up plus a second one for the rest would
have been two chances to word "taken" differently.

`claim()` — the fetch — is exported from `pseudonym-form.tsx` and imported by
`credentials-form.tsx`, rather than the two screens sharing a component. They do
entirely different things with the answer: one navigates on to the game, the
other stays and shows the sentence. A shared *function* is the piece they
actually have in common.

### What each of the three answers does

- **A refused name at sign-up sends the player to `/choose-a-name`, with the
  name they tried.** Not an error on the sign-up form, because by then the
  account exists and there is a session: resubmitting that form would tell them
  their own address is taken. The unpleasant path and the ordinary Google path
  are then the **same path**, so it is walked on every deployment rather than
  being the branch nobody exercises.
- **A guest is refused, and no name is spent on one.** A guest holds a real
  anonymous `user` row — 4.3's design, so their games follow them into an
  account — and the anonymous plugin deletes it the moment they sign up. A
  pseudonym given to that row would afterwards be held by nobody and released by
  nothing.
- **No session and a guest session get the identical refusal.** Both mean *there
  is no account here to name*, and both screens send them to the same place, so
  a client branching on the difference would be branching on something it cannot
  act on differently.

### The gate is on `/play`, and lets two of the three kinds through

`requirePseudonym` stops an account with no pseudonym and lets a guest and a
stranger straight past. That asymmetry is the point: one of this effort's three
conditions for done is a first-time visitor who plays without signing up, and a
gate that stopped everybody without a pseudonym would end that on the day it
shipped.

`/play` is where it lives because it is the one screen every player passes
through and where signing in lands. **`/solo` is deliberately not gated**: it is
a static page reached only by a push from `/play`, and making it dynamic to
catch a path nobody arrives by would cost the prerender for nothing. Rooms are
E.3.3's, where the pseudonym stops being a gate and starts being the identity.

### Two things this step corrected on its way past

**The profile screen was showing `session.user.name`.** Better Auth fills that
column from a Google profile without asking, so on the one screen that promises
*this is what other players see*, it would have shown a player their legal name.
It reads the `profile` row now.

**`pseudonym_taken` is its own error code.** `name_taken` already existed and
means C5.2's thing — *somebody in this room is called that, right now*. A client
that could not tell them apart would offer "try again in a moment" for a name
nobody is ever giving back.

### What it found in the suite that was already there

**Three e2e specs had their own copy of a `someone()` helper, and all three
carried the same defect.** The pseudonym was `Ada` plus the **first six**
base-36 digits of `Date.now()` — which drops the last two, so it changes only
every 1296 ms and ignores the random suffix entirely. The email beside it used
the whole stamp, which is why nothing noticed for four steps.

Harmless while a pseudonym was a label on a `user` row. The moment sign-up
claimed it, two specs starting in the same second wanted the same name, and
whichever lost was carried off to `/choose-a-name` with every assertion after it
failing. Found exactly that way, on the first full run of this step: *expected
`/play`, received `/choose-a-name?attempted=Adamtu99b`* — in
`account.spec.ts`, which has nothing to do with pseudonyms.

The three copies are now one `specs/accounts.ts`, using the whole stamp in both
fields: the clock separates accounts a second apart and the random suffix
separates two in the same millisecond, and neither alone is enough.

## E.3.3 — it is the only public identifier  ⬜

**What we do.** A signed-in player stops typing a nickname per room: the lobby
offers their pseudonym, and `/api/realtime/ticket` mints for it. A guest keeps
typing one, because a guest has no pseudonym to offer.

**Done when** a room, a leaderboard and a shared score show a signed-in player's
pseudonym and nothing else, and two players in one room cannot be shown the same
name.
