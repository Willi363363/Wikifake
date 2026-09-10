# Track G — the periods and the queries

The record of **G.3**, and of **G.4** when it lands. `07-leaderboards.md` keeps
the frame and the step table; `07-leaderboards-steps.md` carries G.1 and G.2 —
the region, and the entries a board may rank.

A second sheet because the first reached 218 lines against a limit of 200. The
split is by subject rather than down the middle: G.1 and G.2 are the data a
board reads, and these are how it is windowed and asked for.

## G.3 — periods: daily, weekly, all-time  ✅

**Done when** a board can be asked for any of the three, and the two that repeat
are measured on the same calendar a quest is.

### The calendar moved, and that is the step

`periodIndexOf` and `periodWindowOf` were written inside `quest-generator.ts`
and `quest-progress.ts`, because that is where they were first needed. G.3 is
the **second consumer**, and two consumers is when shared code gets a neutral
home — the move `button-variants.ts` made out of `button.tsx` when a server
component needed it, with the same sentence attached: *this is not a second
copy, it is the only copy, moved.* Both quest modules re-export what they used
to define, so nothing that learned to import from them had to move.

**It matters more than tidiness.** A board's day and a quest's day have to be
the same day, or a player finishing a daily quest at 00:30 UTC and topping the
daily board are being measured on two clocks. One function decides and both
features ask it, and a test asserts the two windows are *equal* rather than
merely similar — a mutation giving the boards their own Monday arithmetic turns
it red.

`QuestPeriod` is now an alias of `CalendarPeriod` rather than its own union of
the same two strings. Two unions spelling out one pair are two places for a
third value to be added to only one of them.

### All time is a null window, not a very wide one

`boardWindowOf` returns `null` for `allTime`, and the difference is a `where`
clause rather than a nicety: a query handed a window puts a range on
`finished_at`, and one handed null puts no clause there at all. An artificial
range from zero to now would be an index scan over every row to prove that every
row qualifies — which is precisely the plan **G.4** exists to check.

Two cases hold it: the null itself, and that two instants in different days give
the same all-time board. A period-shaped implementation of "all of history"
fails the second.

### Why three periods at all

The track's own words, and worth keeping beside the code: *"an all-time board
alone is a wall the first hundred players build against everybody who arrives
later."* The daily and weekly boards are the answer to that, and they are the
same two periods a quest uses — which is what made the shared calendar
unavoidable rather than merely tidy.

### The identifiers are still in `domain`

F.1's rule, applied a third time: they cross the wire when G.5 puts a period in a
URL, and they can be promoted then. G.1's regions went to `protocol` immediately
because its own step took one from a browser; nothing here does.

## G.4 — queries and their indexes, checked on seeded volume  ✅

**Done when** a board can be asked for by mode, period and region, and its plan
has been read on a table two orders of magnitude larger than the game has.

### The one query, and the join that filters three things at once

`boardQuery` takes a mode, a window or null, a region or null, and a limit. Its
inner join to `profile` is not decoration — it is the filter, doing three jobs a
`where` clause would otherwise have to remember. **A board shows names, and only
a `profile` row has one**, so a guest is excluded, an account that never chose a
pseudonym is excluded, and a deleted account — whose `user_id` E.7 set to null —
is excluded. None has a name to print or a rank to be given.

The order is total: `score desc` is the board, `finished_at asc` gives a tie to
whoever got there first, and `participant_id` breaks the last one so two calls
with the same rows return the same page. Without the third, a board reshuffles
its tied rows between loads.

### The region is a generated column, because a ranking cannot be filtered in code

`effectiveRegion` is `coalesce(chosen, derived, 'other')` in `domain`, and a
regional board needs that rule **in SQL**: the `limit` comes after the `where`,
so a query that narrowed afterwards would have to fetch everything first.

So the rule exists twice, and `profile.effective_region` is what makes that safe
— `generated always`, so nothing can write it and it cannot disagree with its own
inputs, indexed so a board can filter on a column rather than repeat an
expression. The pair is held together by a test over every combination of the two
source columns, which is E.4's arrangement a third time.

### What the volume test measured, and what it refused to claim

Fifty thousand graded rounds over two thousand players, seeded with
`generate_series`, then `analyze` — without it a bad plan would be missing
statistics rather than a missing index.

**The test's shape changed three times, and each change was the measurement
telling me I was wrong.**

1. *No sequential scan of the entries.* Failed on the all-time board — and the
   planner was right: fifty thousand narrow rows are eight megabytes, and it
   answers in 18 ms. **Asserting against that is asserting against the cost
   model.**
2. *An index can serve the order, with `enable_seqscan` off.* Failed on the
   daily board, and this one is inherent: **no index can both range on
   `finished_at` and order by `score`.** A windowed board must sort.
3. *The all-time board needs no sort.* Failed too. An index on `(mode, score
   desc, finished_at, participant_id)` *can* deliver the order — but the board
   joins `profile` for a name, Postgres hashes two thousand profiles rather than
   probing one per entry, and **a hash join loses the input order**. Forcing a
   nested loop takes three planner flags and produces a plan production would
   never choose.

So the assertions are per-board, and each says something true:

- **the windowed boards** push their range into the index — `Index Cond` naming
  `finished_at` — and sort only the window with a bounded top-N heapsort. Their
  cost grows with the period, which is the property that matters;
- **the all-time board** sorts its whole mode, asserted *in both directions*: a
  bounded heapsort in memory, and an input larger than a quarter of the table.

### The measurement, and the limit it found

```
daily      2 ms     range in the index, top-N heapsort over the day
weekly     2 ms     the same, over the week
regional   3 ms     the same, plus profile.effective_region
all-time  18 ms     Seq Scan 25,000 -> Hash Join -> top-N heapsort
```

**The all-time board's cost grows with the game's whole history**, where every
other board's grows with its period. Fine here, seconds at a hundred times it.
The two ways out are decisions rather than tweaks:

- **denormalise the pseudonym onto `leaderboard_entry`**, so no join is needed
  and an ordered index scan can stop after fifty rows. E.3.2 already decided a
  pseudonym is claimed once and never renamed, which makes the stale-name
  objection cheaper than it sounds;
- **materialise a top-N per board**, refreshed on write or on a schedule. More
  moving parts, and the shape that survives a million players.

The test asserts the current shape in both directions deliberately, so whichever
is chosen turns that case red and the person choosing has to say so there.
`../current-state/06-structural-debt.md` carries a pointer.

### Two indexes, and one of them the test demanded

`leaderboard_mode_finished_idx` — `(mode, finished_at, score)` — serves the
windowed boards. `leaderboard_mode_score_idx` — `(mode, score desc, finished_at,
participant_id)`, partial on `user_id is not null` — was **added because the
volume test refused the all-time query**, and it is what makes an ordered scan
possible at a size where the planner would choose it. All four ordering columns,
because three of four leaves an incremental sort.
