# Track F — what each step decided

The record of track F's steps: what each one settled, and what it got wrong
before it was right. `06-quests.md` keeps the frame — objective, the constraint
that decides the design, the step table and the exit gate — and the table there
is the only place that says where a step stands.

Its own sheet because the frame file reached 182 of its 200 lines, and
`../method/00-dev-cycle.md` says a phase that outgrows its file splits into
satellite sheets rather than being squeezed into one.

### F.1 — what the catalogue decided

**A rule may only count what a finished round already carries.** Checked against
the schema rather than assumed: `participant` holds `submitted_at`, `score`,
`true_positives`, `false_positives` and `hints_used`, and its `game` holds `mode`
and `total_fakes`. That constraint is what made the file short, and it ruled a
quest out: **a streak has no time dimension**, since `player_stats` holds the
current and best streak as running totals with no date on them, so "a streak of
three today" is unanswerable. It is written down in `quests.ts` so the step that
wants it starts from a decision.

It also ruled out *"use three items today"* — **and that was wrong.** F.3 found
`item_use` one table over while reading the schema; the correction is in F.3's
section below, and in `quests.ts`. What this step got right was checking the
schema at all; what it got wrong was checking only the two tables it expected
the answer to be in.

**A rule is a tally, a qualifier, a period, a range and a reward.** The tally is
what accumulates — rounds, falsifications found, or points — and the qualifier is
which finished rounds count: `any`, `perfect`, `noHints`, `nothingWronglyMarked`,
`multiplayer`.

**The qualifier is data and never a predicate.** E.4 already had to hand
`isPerfectRound` into `queries/stats.ts` as an argument, because *data does not
depend on rules* and `@wikifake/db` may not import `domain`. A qualifier
expressed as a function is one F.4 cannot turn into a `where` clause, so it would
force the progress reader to walk every round a player has ever played.

**`points` is the sum of each qualifying round's score floored at zero.** C2.3
lets a score be negative and does not clamp it, so an unfloored sum would hand a
player a quest whose progress goes *down* after a bad round. F.4 implements the
floor; F.1 chose it.

**The identifiers stay in `domain` until a quest crosses the wire.** `protocol`
holds the identifiers that are message contracts — that is what `items.ts` means
by it — and F.1 sends nothing anywhere. They become a `protocol` enum at F.7,
which is a re-export rather than a rename because nothing outside the package
reads them before then.

**The reward is a number of coins, and there is no wallet.** Track H owns the
balance; F.6 credits inside the transaction that marks a quest claimed. Until
then a reward is what a quest is worth. Daily to weekly is roughly one to four
and not one to seven: a weekly set that pays a week of dailies makes the dailies
pointless.

**`solo` was in the qualifier union and is not any more.** Nothing counted it —
every daily is completable alone already — and a dead member is a `case` F.4 must
write, a branch a test must cover, and a promise on the quests screen no rule
keeps. `quests.test.ts` holds that: every qualifier and every tally has a rule
using it.

### F.2 — what the generator decided

**The seed is derived, not passed in**, which is the opposite of `selectTopic`
and the reason is the requirement. That draw must be *unpredictable* — a seed
handed in is what stops the fastest voter always winning — and this one must be
*reproducible*. Same purity rule, opposite need: `generateQuestSet(user, period,
periodIndex)` is a function of its arguments and the catalogue, and nothing else.

**A period is an integer index, not a formatted date.** `new Date(...)` is
forbidden in `domain` — `purity.test.ts` refuses it — so printing `2026-09-10`
here would mean implementing civil-date arithmetic for a string only a human
reads. `periodIndexOf` is two lines of integer arithmetic, it gets leap years
right for free, and the index is what F.3 needs anyway: `(user, period,
periodIndex, ruleId)` unique is what makes a second cron run write nothing.

**A daily set turns over at midnight UTC**, so 01:00 or 02:00 for a French
player. Deliberate: a per-player boundary means the cron cannot assign everybody
at once, and a per-player time zone is a preference E.5 already deferred to
`profile.preferences`. `periodIndexOf` is the one function that learns about it
when it arrives. Weeks start on Monday — epoch day 0 was a Thursday, hence the
`+3`.

**Three of five daily, two of five weekly.** A set holding every rule would be
the same set for ever, and the generator would have nothing to be deterministic
*about*. Shuffle-then-take rather than pick-k, because picking has to handle the
same rule drawn twice and every way of handling that either biases or loops.

**The draw order is load-bearing.** Shuffle, then one target per chosen rule in
the shuffled order. Drawing targets before the shuffle, or for every rule rather
than the chosen ones, gives a different set from the same seed — a silent break
of the only guarantee this step exists for.

#### What the mutation run found, including in the tests themselves

Three deliberate breakages, and only two were caught:

- an **exclusive maximum** (`max - min` instead of `max - min + 1`) — caught;
- **weeks aligned to Thursday** (`day / 7` instead of `(day + 3) / 7`) — caught;
- **the seed's `|` separators removed** — *not* caught, and correctly so. Plain
  concatenation is already unambiguous for these three components: the period is
  an alphabetic word sitting between an identifier and a run of digits.

So a test claiming to prove the separators were load-bearing was deleted rather
than kept, and the source comment now says they are insurance for a key that
gains a fourth component — not a fix for a collision that exists today. **A test
that passes with and without the thing it guards is worse than no test**, and a
mutation run is what tells the two apart.

Two thresholds in the tests were also wrong on the first pass, both for the same
reason — a bound that no correct implementation could meet. Asking every rule to
draw both ends of its range fails on a range 2,001 values wide, and asking for
twenty distinct targets fails on a range holding seven. Ranges narrow enough to
enumerate are now covered entirely; wider ones are asked for twenty.

## F.3 — one table, and the step that was re-cut to say so

**Done when** a quest set can be written down, read back, and written a second
time without duplicating — the last being what F.5's cron rests on.

### The plan asked for two tables and one of them should not exist

F.3 was written as "`quest_assignment` and `quest_progress` tables". The same
file says, four paragraphs earlier, that **progress is derived from the events
the game already writes**. Both cannot be true.

Checked rather than argued: every tally and every qualifier F.1 declares is
answerable by one aggregate over `participant` joined to `game`, windowed on
`submitted_at`. So a progress table would hold a second copy of a number that
already exists — and *a stored column that can disagree with its own inputs is a
bug with a schema* is the rule `player_stats` was designed around at E.4.

So the step was re-cut. This is the second of `../method/00-dev-cycle.md`'s three
overflow cases — the step was badly cut, so the plan is rewritten and then the
work resumes — and it is the first time in this effort that the re-cut made a
step **smaller**.

### What is stored is a promise, not a derivation

The assignment is stored because it is a promise made to a player, and two
columns carry the whole of that argument.

**`target` is stored, and it is the reason the row exists.** The generator is
deterministic *given the catalogue*, so a target is reproducible right up until
somebody widens a rule's range. Storing it freezes the promise: a player who has
found four of a required six keeps needing six, even after an edit that would
now draw eight. `assignQuests` therefore does **not** update on conflict, and a
test holds it — a catalogue edit reaches tomorrow's set and leaves today's alone.

**`reward` is not stored, and that asymmetry is deliberate.** A target is what a
draw produced; a reward is what the catalogue says a rule pays, with one place to
read it. Changing a reward does change what an unclaimed quest pays — the
alternative is honouring an economy we have retired — and F.6 reads the catalogue
when it credits.

### `rule_id` is text where `item_id` is an enum

Three reasons, and the third decides it. The quest catalogue is *meant* to grow,
and a `pgEnum` makes every new rule a migration. A retired rule still has rows
naming it, and an enum value cannot be dropped while a row holds it. And **`db`
may not import `@wikifake/domain`** — `workspace-graph.test.ts` refuses it,
because data does not depend on rules — while the identifiers are not in
`protocol` until F.7 puts them on the wire.

That same boundary is why `QuestToAssign` is declared in `queries/quests.ts`
rather than imported: the caller depends on both packages and maps one onto the
other, exactly as `recordSubmission` is handed `isPerfectRound` instead of
reaching for it.

### Idempotence is a constraint, and the test proves it is

`unique(user_id, period, period_index, rule_id)` is what makes a second write a
no-op. `onConflictDoNothing` is a convenience over it, and the suite asserts both
halves — the convenience returning `0`, and a raw insert coming back `23505` —
because if the index were ever dropped the first assertion would keep passing
over a silent duplicate.

The case that matters most is two transactions opened before either commits: the
cron writing while a player loads the screen is F.5's *ordinary* case, since its
read path is self-healing, and it is exactly what a read-then-insert could not
survive. One of the two returns 3 and the other 0; which is not decided and does
not matter.

### What it found next door

**F.1's note that items used are not recorded is wrong.** `audit.ts`'s `item_use`
has carried `caster_id`, `item_id` and `used_at` since phase 2, and a join
through `participant` reaches the player — so "cast three items this week" is a
rule the catalogue may express after all. What misled F.1 was
`participant.score_stolen`, which really is what was done *to* a player; the
caster's side is one table over. Corrected in `quests.ts` and above. No rule uses
it yet, and the correction is recorded so the next one may.
