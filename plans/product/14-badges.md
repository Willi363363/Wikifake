# Track M — badges

| | |
|---|---|
| **State** | ✅ done — two steps: the catalogue, and the profile |
| **Branch** | one per step |
| **Depends on** | track E — it reads `player_stats` and adds no column |
| **Delivers** | a ladder that survives the weekly reset |

## Why, and what quests do not cover

Track F answers *a reason to come back tomorrow*. It does not answer **a reason
to have come back for six months**: a quest set is drawn, claimed and gone, and
the counters underneath it — `games_finished`, `best_streak`, `falsifications_found`
— have been climbing since track E without anything ever saying so.

So a player who has played four hundred rounds and one who played three see the
same profile shape. The numbers are on it, but a number is not a rung: nothing
says *this is a threshold, and there is another one above it*.

**A badge is that rung, and nothing else.** It is not a reward — claiming, coins
and the wallet are track H's and stay there. A badge is a fact about a counter,
rendered.

## The constraint, inherited whole

The owner's requirement that shaped track F shapes this one: *once the app is
launched I want nothing left to do*. **So a badge carries no content.** It is an
identifier, a metric and a threshold, and the catalogue is written once.

It is the same file shape as `quests.ts` and `cosmetics.ts`, for the same reason
both give: a business rule that must exist in exactly one place, with its name
in the i18n catalogue keyed by its identifier.

## Derived, never stored — and what that costs

A badge is a threshold on a counter `player_stats` already holds, so it is
recomputable at any instant. Storing one would be a second copy of a fact its own
inputs already answer — the argument `05-accounts.md` makes about
`gamesAbandoned`, `averageScore` and `accuracy`, all three derived for the same
reason.

**Two consequences, stated rather than discovered:**

- **No migration**, now or for a new badge. The catalogue can grow, shrink or be
  recalibrated without touching the schema.
- **No earned-at date, and therefore no notification.** Nothing knows *when* a
  badge was crossed, so nothing can say *you have just earned this*. That is a
  real loss and it is the price of the line above. A badge that must announce
  itself needs a row, and that is a later step with an argument of its own.

## Ratios need a floor, and that is a rule rather than a detail

A player who finished one perfect round has an accuracy of 1. Without a minimum
they would hold the top accuracy badge, above somebody at 0.94 over four hundred
rounds — which is the opposite of what the badge is for.

So a badge may require a number of finished rounds before its metric is read at
all. Only the ratio badges use it, and a test holds the pairing: **a metric that
is a ratio must carry a floor.**

## Steps

| # | Step | State |
|---|---|---|
| M.1 | The badge catalogue and the reader, as pure data in `domain` | ✅ |
| M.2 | The badges on the profile, with the next rung | ✅ |

### M.1 — the catalogue

Fifteen badges over five metrics, each metric a ladder of three or four rungs so
that there is always a next one. The thresholds are calibrated against the
scoring scale rather than guessed: `PER_TRUE_POSITIVE` is 150 and a real article
carries two to four falsifications, so a strong round is roughly 300 to 700 with
the time bonus — which is what the score ladder's rungs are.

`badgesEarned` returns what is held; `nextBadgeIn` returns the rung above, or
null at the top of a ladder. The second is what makes the screen a ladder rather
than a list, and it belongs here because *which badge is next* is a fact about
the catalogue.

### M.2 — the section, and the one row that would have lied

Two questions in this order: *what do I hold*, then *what is next*. A list of
things already true is a trophy case; the rung underneath is what makes it a
ladder, which is the whole track.

**A next row names the rung, not the metric.** The first draft labelled each row
with its counter — *Rounds finished*, *Best streak* — and the full suite caught
what that meant: those words were already on the screen, on the stat tile three
inches above, saying a different number. One label, two meanings. Naming the
badge being climbed towards says something the tile does not, and the duplicate
goes with it. A finished ladder then has no row at all, because every row names
a rung and one with nothing above it has nothing to say.

**A floored rung shows the floor, not the metric.** A player at 80% accuracy over
five rounds does not hold `ACCURACY_75` — the floor is twenty finished rounds —
and a row reading `80% / 75%` would tell them they had earned something they had
not. `gapTo` shows the blocking condition instead, and that case is the reason
the function exists rather than an inline subtraction.

**The chips are `ink` on `accent-soft`**, which `contrast.ts` already measures
and names *"the accent badge"*. Nothing new was invented to colour them, so they
pass in both palettes by the audit that already runs.

**The copy has the guard F.8 earned.** `t(`names.${badge.id}`)` and
`t(`metrics.${metric}`)` are keys composed at runtime, which is exactly the shape
no existing gate can see — `badge-copy.test.ts` holds the catalogue and both
locales together, in both directions, reading data alone so it never skips.

## Exit gate

- A new badge is one row in the catalogue and one message per locale — no
  migration, no query, no reader change.
- A player with one finished round holds no ratio badge.
- Every badge has a name in every locale, held by a test rather than by a review.
