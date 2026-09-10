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
