# Track G — what each step decided

The record of track G's steps. `07-leaderboards.md` keeps the frame — the
objective, the region argument, the thresholds and the step table, which is the
only place that says where a step stands.

## G.1 — region on the profile: derived, overridable  ✅

**Done when** an account's region is inferred from the request that created its
profile, a player can set their own, and theirs is the one a board reads.

### Three regions, not six continents

The track asks for "Europe, the Americas, and the rest", so those are the
values. The frame says the code is "mapped to a continent and stored as that
continent" — and storing an actual continent would mean storing Africa, Asia and
Oceania separately, which no board reads.

That is decided against for the track's own reason. Its region argument is that
*a coarse region derived from an existing header is a very different thing,
legally and ethically, from geolocating a player* — and the same logic says not
to store finer than the product uses. F.1 dropped a qualifier nothing counted on
the same grounds. When a fourth board is wanted, the mapping changes and the
column does not: it holds a region, and one function decides which.

### Two columns, and no flag

`derived_region` is the inference and `chosen_region` is the choice, so each
means exactly one thing and no code has to ask which a single value happens to
be. `effectiveRegion` is chosen, then derived, then `other`.

**The choice always wins**, which the track promises. It is right for a
traveller — a header follows the network, not the person — and it is the
simplest answer to anybody who objects to the inference: they can set it, and
their setting counts.

**A column and not a `preferences` key**, unlike every other thing a player
toggles. That column's own comment says why: `jsonb` is for preferences nothing
queries or joins on, and a regional board is a `where` clause on this value.

### The inference is written once, where the row is created

`claimPseudonym` gained an optional derived region, written *with* the insert
rather than in a second statement: a profile that existed for a moment without
one would be a profile some query could read in that moment. And it is never an
update — re-deriving on a later request would move a travelling player's board
under them every trip.

E.3.2 makes that free to hold: the claim creates and never renames, so a second
claim from another country is refused as taken *and* leaves the region alone. A
test drives exactly that path.

### The identifiers are in `protocol`, and F.1's are not

Not an inconsistency — the rule. `protocol` holds identifiers that cross the
wire, and these cross it in the step that introduces them, because
`POST /api/account/region` takes one from a browser and has to validate it
against a closed list. Quest rule identifiers crossed nothing until F.7. What a
region *means* — which codes fall in it — stays a rule, in `domain`.

The closed list is also what stands in for the Postgres enum the columns
deliberately do not have, and `effectiveRegion` reads a stored value that is not
one of the three as absent rather than as a fourth board.

### The header is never trusted, and never needs to be

`x-vercel-ip-country` is a request header, so a client can send whatever it
likes. It is read only on the server, only to derive a default the player may
overrule, and it decides nothing else — so a player who forges it has chosen
their own board, which is a thing this handler lets them do anyway.

Absent is the ordinary case rather than a failure: every local run, and any
deployment behind a different CDN. `regionForCountry` answers `other` for
anything it cannot place, so there is no input without an answer.

### What the mutation run found

Three breakages, and only one was a defect:

- **the inference put ahead of the choice** — four cases red, across both
  suites. The property the track argues for, held where it is visible;
- **the two `includes` checks swapped** — survived, *correctly*: the lists are
  disjoint, so order cannot matter. But sampling could not have told the
  difference, so the assertion is now a sweep of all 676 two-letter codes,
  counted by region. `BR` added to the European list turns it red, and the two
  counts are a tripwire: adding a country changes one, which is the moment to
  check it is not already in the other;
- **the explicit guest check removed** — survived, also correctly. A guest has
  no `profile` row, so the update finds nothing and refuses anyway. It stays
  because the two refusals are not the same claim — one says *a guest has no
  account*, the other *this account has no pseudonym* — and a test covers the
  guest path even though the second refusal is what answers it today.

## G.2 — `leaderboard_entry`, written when a round finishes  ✅

**Done when** a graded round is eligible to be ranked, an ungraded one is
eligible nowhere, and the table can be rebuilt from the rounds it describes.

### The table was a fork, and the owner chose it

`participant` can already express everything a board shows — its own check ties
`submitted_at` to `score`, so "finished and server-graded" is one predicate —
and Postgres holds those queries with the right indexes. So this was put to the
owner with the cost named: **a second write path, and a figure that can drift.**
They chose the table, for the reason the option carried: *a row exists here if
and only if the server graded a round*, which is the track's anti-cheat rule
turned into a table rather than a `where` clause every future query has to
remember.

Both halves of the cost are answered rather than accepted:

- **The write is inside `recordSubmission`'s transaction**, beside E.4's
  statistics. An entry without a grading is a score nobody earned; a grading
  without an entry is a board that silently forgets a round.
- **`rebuildLeaderboard` derives the whole table from `participant`**, and
  `leaderboard.test.ts` plays a mixed field through the real path and asserts the
  rebuild is identical. That is E.4's arrangement for `player_stats`, and it
  earned itself here too — see below.

### What is denormalised, and what is deliberately not

Score, mode and the finishing instant: all three are fixed once a round is over.
**The region is not here.** It is `profile`'s, joined at query time, because G.1
lets a player change it — a denormalised copy would mean rewriting history every
time somebody travels.

`participant_id` is the primary key rather than a surrogate id with a unique
index beside it: a round is graded once, so a second entry for the same
participation is not a duplicate to tidy up but a score that was never earned.
`on conflict do nothing` therefore keeps the first, where an update would let a
replayed request overwrite a score with one computed against a later clock.

`user_id` is `set null` and not `cascade`, which is E.7's shape: deleting an
account leaves the rounds it played coherent, and the boards of G.4 must skip a
row with no owner rather than the row not existing.

### A guest's round is eligible, and has no owner

The first thing the rebuild caught. The entry was written inside the
`userId != null` branch that `player_stats` needs — so **every guest round was
missing**, and the two paths disagreed. A guest is part of the field the other
players were ranked against, so the round is eligible; no board will print their
name, which is the same thing E.7 arranges for a deleted account.

### The constraint this file first carried, and removed

`check('score is not null')` beside a `not null` column: a constraint no insert
can violate, which is worse than none because it reads as a guarantee somebody
checked. C2.3 lets a score be negative and nothing clamps it, so there is no
range to refuse either.

### What the mutation run found

Three breakages, three caught: the entry written only for accounts (the guest
case *and* the rebuild), `do nothing` turned into `do update` (the retry case),
and the rebuild's eligibility filter dropped (the rebuild case).

### And one thing the test got wrong

The account-deletion case first used a raw `delete from "user"` and failed.
**That statement aborts by design** — `participant_account_or_guest` fires on a
solo round whose `user_id` became null and which never had a `guest_name` — and
E.7 documented it, asserted it, and built `deleteAccount` around it. The test
goes through that function now. The register earning itself is the point worth
keeping: the finding was written down, and it cost one failed run rather than an
afternoon.
