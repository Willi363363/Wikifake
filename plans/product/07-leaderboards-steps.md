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
