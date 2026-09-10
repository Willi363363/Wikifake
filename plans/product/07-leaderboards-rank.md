# Track G — a player's own rank

The record of **G.7**, and the close of the track. `07-leaderboards.md` keeps
the frame and the step table; `07-leaderboards-steps.md` carries G.1 and G.2,
`07-leaderboards-queries.md` G.3 and G.4, and `07-leaderboards-screen.md` G.5
and G.6.

A fourth sheet because the third reached 228 lines against a limit of 200. G.7
earns one: it is the step that found a defect in G.5, moved G.4's measured
limit, and had two of its own rules escape a mutation run.

## G.7 — your own rank, and the rows around it  ✅

**Done when** a signed-in player is shown where they stand, on a board that has
enough players to show anything.

### It found a defect in G.5, and the defect was mine

**The board listed rounds, not players.** A player with five good rounds took
five of the fifty rows — and a G.6 case asserted exactly that, so the suite was
quietly documenting it. *"Your own rank"* has no meaning when a player has five
of them, and the plan asks for "a world ranking" and "your own rank", both
singular.

Put to the owner as a fork, and they chose one row per player. So a board is now
each player's **best** round in the period: `distinct on (user_id)` with the
inner order `user_id, score desc, finished_at asc`, and the outer order ranks
those bests. Among a player's own equal bests the earliest wins, which is the
board's own tie-break applied to a player against themselves.

The stale case is corrected rather than deleted, and says what it used to assert
and why that was the defect.

### The rank is competition ranking, and it agrees with the rows

One more than the number of players who did strictly better — a higher best, or
the same best reached earlier, which is the board's own tie-break, so **a rank
and a row position cannot disagree.** A test walks every row and asserts its
position equals its own rank. Two players tied share a rank, which is what every
scoreboard a player has ever read does.

Null when the player has no qualifying round in the period, which is a different
thing from a rank of zero: they are not last, they are not on this board.

### A closed board says nothing about a rank, and only the read path can enforce it

G.6 handed this step a warning — *a closed board must not show a rank either, or
the threshold leaks the ranking it exists to hide* — and a mutation proved the
screen alone could not hold it. A screen test is handed `own` and can only render
what it is given, so putting the rule in the read path is what makes it true, and
the case that catches it had to live there too. The leak would reach exactly the
player most likely to share it.

### The block appears only when the player is off the page

A player inside the top fifty is already visible and their row is marked, so a
second block repeating it would be the screen saying the same thing twice. The
neighbours are one either side — enough to see the gap to close, short enough not
to be a second board.

`aria-current` marks the viewer's row in both tables. Colour alone is visible and
not audible.

**The offset arithmetic is off by one in the obvious direction**, so it is
spelled out where it is pinned: `offset` is zero-based, a rank of R sits at R-1,
and a window of one either side starts at R-2. It comes back *short* at the end
of a board rather than padded, and a screen assuming three rows would render an
empty one.

### What the mutation run found, including two gaps

Four breakages. Two were caught immediately — the rank off by one, and the
`distinct on` removed so a board listed rounds again. **Two escaped**, and both
for the same reason: they were read-path rules with only screen tests over them.
A rank returned on a closed board, and the neighbour block fetched for a player
already on the page. Both now have cases in `board.test.ts`, and both mutations
fail against them.

### And it moved G.4's limit rather than removing it

G.4's volume test asserts the all-time board's shape *in both directions*, so
this step turned it red — which is the tripwire working exactly as it was
written to. The sort's input fell from twenty-five thousand entries to two
thousand players, and the assertion now says so.

The cost went **up**, not down: 45 ms against 18 ms, because deduplicating
twenty-five thousand rows is more work than sorting them. Both are proportional
to the history, so the limit moved from the sort to the scan. The register is
updated with the new number.
