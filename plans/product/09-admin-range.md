# Track I — the date range

The record of **I.8**, the last step of the track. `09-admin.md` keeps the
frame and the step table.

## I.8 — a date range, applied across every section  ✅

**Done when** one control narrows the panel, and every figure it cannot narrow
says so.

## Three kinds of figure, and only two of them can be ranged

The panel reads three kinds of thing, and that is the whole substance of this
step:

- **Events with a timestamp** — a round, a model call. A range is a `where`
  clause and the figure means exactly what it says. Games, cost and content.
- **A cohort** — accounts, which have a creation date. The range picks *who*
  rather than *when*, which is what an activation figure has always meant:
  *of the people who signed up in September, how many played* is a question
  about September's arrivals, whenever they played.
- **A running total** — `player_stats.games_finished`, kept since E.4 as an
  aggregate maintained rather than recomputed. **There is no date on it**, so
  "rounds finished this week" is a question the schema cannot answer.

**Applying a range to the third kind anyway would produce a number that looks
ranged and is not** — the worst of the three outcomes, because nobody can see
it. So the most-active list stays all-time and says so under its own heading,
health says it is a live probe, and the chooser names which sections it moves.

A control that silently left two of six sections alone would be a control that
lied about a third of the screen.

## In the URL, not in state

Two links per preset, the server renders what they ask for, and a browser with
no JavaScript gets every one of them — G.5's decision about board periods, for
the same reasons: a range is bookmarkable, shareable, and survives the reload
somebody does when a figure surprises them.

**Anything unrecognised is the default, not a 400.** A panel is not a form; a
mistyped query string should show a month. And the chooser highlights what is
*actually being shown*, so an unrecognised value comes back under the default's
name rather than as itself — a mutation that reported the typo as chosen fails.

## A range ends at the end of today

Not at this instant. A player who finished a round ten minutes ago belongs in
"the last seven days", and a bound of *now* would leave them out of a figure
every reader expects to include them — and would make the same page show
different numbers on each refresh.

Half-open at both ends, like every window here: a round at the last millisecond
of the last day is in, and the first instant of the next day is not.

## All time is the absence of a bound

`windowOf` returns **null**, and the queries put no clause on a timestamp at
all. G.3 made the same distinction for the all-time leaderboard: a query given
an artificial range is an index scan proving that every row qualifies.

The mutation that turns it into a very wide window fails forty-two cases, which
is what a shared decision looks like when it is actually shared.

## Two details the queries had to get right

**A seat has no date of its own.** `participant` carries no timestamp until it
is submitted, so the round's `started_at` decides whether a seat is in the
window — using the submission would drop exactly the abandoned seats being
counted.

**The day series keeps its own lower bound**, even on an all-time range: a
chart with one bar per day since the beginning is not a chart.

## Mutations that must go red

- The range ending at this instant.
- All time becoming a very wide window.
- An unrecognised preset reported as chosen.
- The funnel ignoring the cohort.
- The most-active list narrowed after all.
- The chooser no longer saying what it cannot move.
