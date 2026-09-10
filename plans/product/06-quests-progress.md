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

## F.5 — the cron, and the read path that makes it optional  ✅

**Done when** a scheduled run gives every recently active player their sets, a
second run for the same day writes nothing, and a player the schedule never
reached still has quests on the request that asks for them.

### The read path is the guarantee, and it is the whole design

The plan says it in one line — *the cron is an optimisation; the read path is
the guarantee* — and building it that way round is what makes both of F.5's
demanded properties free.

`readLiveQuests` generates a missing set on the request that asks for it. So
**"a player created at 03:00 sees quests immediately"** is not something a
schedule has to get right, and **"the quest engine is stopped entirely and a
full game still plays"** costs nobody a quest rather than merely not crashing.

**Idempotence** then comes from F.2 and F.3 rather than from any code here:
`generateQuestSet` is deterministic and `assignQuests` writes nothing on
conflict, so a second run for the same day reports `assigned: 0`. That count is
the *evidence* — a run that assigned nothing and a run that never happened look
different in a log.

### It re-reads after writing, and that is not a formality

`rowsFor` writes the generated set and then **selects it back** rather than
returning what it generated. Two requests can arrive together, or the cron can
be running: `assignQuests` deliberately does not update on conflict, so the rows
are the promise and the generated list is only a proposal. Returning the proposal
would show a player a target that is not the one stored against their name — and
a mutation doing exactly that turns the second-read case red.

### The cron looks fourteen days back, and that is a decision

Pre-generating for a player who has not touched the game in months writes five
rows a day, for ever, that nobody will read. The read path covers them, so the
cron optimises for the players who will actually look. A returning player loses
nothing: they get their set on the request that brings them back, and a test
asserts exactly that for a player last seen thirty days ago.

**One schedule covers both periods**, which is `assignQuests` being idempotent
rather than a coincidence: a daily run re-offers the weekly set every day, six of
those seven writes are conflicts, and the Monday is the one that lands.

### Absent secret means refused, never open

`CRON_SECRET` is optional in the schema and not optional in effect: the route
answers 503 when it is unset. A forgotten variable must not turn this into a
public endpoint that rewrites every player's quests, and the cost of failing
closed is a cron that logs until somebody sets it — a failure with a symptom.
`REALTIME_ALLOWED_ORIGINS` made the same choice and the phase-9 harness caught a
misconfiguration on its first run because of it.

503 rather than 401 is deliberate too: nothing is wrong with the request, the
deployment is not configured, and a log has to tell those apart. The token
comparison checks length first and then every byte, so a prefix of the right
token is refused — asserted, because `startsWith` passes every other case.

### Two guards in this repository found the route before CI did

**`route-parity.test.ts`** refused a handler the REST catalogue does not
describe, which is C8.1 doing its job: no schema, no generated documentation, no
contract. So `rest/quests.ts` exists, the route is in `ROUTES`, and the handler
answers through `json(questCronResponse, …)` like every other one.

**Then the generated `rest.md` crossed 200 lines** — and `docs.test.ts` had
already written down what happens: *"a message added to the protocol has to fit,
or the pages have to be split again."* So it split, on the boundary that stays
true as routes are added — **is there a browser at the other end** — giving
`rest-operations.md` for the probes and the cron. A split down the middle of a
list would have to be redone every time the list grew.

That split also found two stale counts, both hand-written in prose: the index
said "the nine REST routes" while there were twelve, and the REST page said
"Twelve routes" as the thirteenth arrived. Both are derived now, in digits
rather than words — the house style of spelling numbers out is what made them
easy to leave alone.

### The mutation run

Four breakages, four caught:

- the secret check inverted, so an unset `CRON_SECRET` ran open — the 503 case;
- `tokensMatch` reduced to `startsWith` — the prefix case;
- the read path returning its proposal instead of re-reading — the second-read
  case;
- the weekly window computed as a daily one — the Wednesday-inside-this-week
  case, which is why that case exists at all.
