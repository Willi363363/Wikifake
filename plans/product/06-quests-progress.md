# Track F — progress, and where it is counted

The record of **F.4**. `06-quests.md` keeps the frame and the step table — the
only place that says where a step stands — and `06-quests-steps.md` carries F.1
to F.3.

A third file because the second reached 193 of its 200 lines. Three sheets is
what track E ended with too, and the rule is the same:
`../method/00-dev-cycle.md` says a phase that outgrows its file splits rather
than squeezing.

## F.4 — progress derived from existing game events  ✅

**Done when** a rule's progress can be computed for a player and a period from
rounds the game already wrote down, with nothing in the round's path knowing
quests exist.

## It is derived, and F.3 is why there is nothing to invalidate

F.3 removed `quest_progress`. So this step is not "fill in a table": it is the
only thing that answers *how far has this player got*, and it answers it from
`participant` joined to `game` every time it is asked. There is no cache, so
there is no invalidation, so there is no way for a quest's progress to be stale
after a round — which is the failure a progress table would have had to be
designed against.

**Nothing in the game loop changed, and that is the track's own rule.** *A quest
must never be able to break a round.* No write was added to the round's path, no
hook, no trigger: the reader looks at rows that were already there for
`player_stats` and the debrief.

## The reason F.1 gave for data-not-predicates was wrong

F.1 recorded that the qualifier is data "so F.4 can turn it into a `where`
clause". **The conclusion is right and that reason is not**, and the difference
matters because it decides where the counting lives.

The catalogue has to be data because it is stored, sent to a browser and keyed
by. It does **not** follow that a query should interpret it — and interpreting it
in SQL would mean writing `true_positives = total_fakes and false_positives = 0`
into a query, which is a second definition of a perfect round, in a package that
*may not import the first one*. E.4 already refused that trade: `recordSubmission`
is handed `isPerfectRound` rather than reaching for it, precisely so the rule has
one home. A `where` clause would have quietly given it two.

So `qualifies` and `progressFor` live in `domain` beside `isPerfectRound`, and
`selectRoundsInWindow` in `db` counts nothing at all — it takes two instants and
returns rows.

**What that costs is reading a period's rounds instead of one aggregate row**,
and the window is what makes it free: a day is a handful of rounds, a week a few
dozen. F.1's worry — "walk every round a player has ever played" — was about an
unwindowed query, and there is no unwindowed query here.

## The window is half-open, and both halves say so

`periodWindowOf` is `periodIndexOf` run backwards: `[fromMs, toMs)`. A closed
window has to name its last instant, and whichever it named would be a
millisecond short or one long — two periods sharing a boundary, and a round
submitted exactly on it counting twice.

The pair is asserted as an *inverse* over a year of days and weeks: an instant
must fall inside the window of the period `periodIndexOf` puts it in. Each
function alone passes its own tests while the two disagree by a day, and that
would count progress against the wrong set. `periodIndexOf` is imported into
that test rather than restated — a local copy of the arithmetic is what made
F.2's separator test worthless.

**A round counts for the period it was *submitted* in**, not started in. Its
numbers do not exist until it is graded, and `started_at` would let a player
hold a round open across midnight to choose which day it counted for.

## Two decisions a screen will lean on

**`points` is floored per round, not over the sum.** F.1 chose the floor and
this is where the two readings diverge: a day of 400 then −150 is 250 if the sum
is floored and 400 if each round is. Per round is right — a bad round is worth
nothing, and nothing is not negative. A test pins the arithmetic, and a second
one holds the property behind it: adding a round can never move progress down.

**Nothing is capped at the target.** A player who finished five rounds towards a
quest asking three has done five. A screen that wants "3 / 3" holds the minimum
itself, whereas a capped reader could never tell a quest that is just complete
from one passed while a claim was in flight — which is exactly what F.6 needs to
know.

## What the mutation run said

Four breakages, four caught — the first run in this track where nothing got
through:

- the per-round floor removed — the floor case and the never-retreat property;
- a week's window aligned to the epoch instead of to Monday — the Monday case
  and the inverse property;
- `perfect` reduced to its first half, rewarding a player who marks every
  paragraph — the `isPerfectRound` case;
- the query's range flipped from `[from, to)` to `(from, to]` — the half-open
  case, in the database suite rather than the domain one.

That last pair is why the boundary is asserted twice. `periodWindowOf` decides
the convention and `selectRoundsInWindow` has to agree with it, and neither
suite can see the other's half.
