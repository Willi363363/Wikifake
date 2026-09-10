# Track H — earning

The record of **H.3**. `08-economy.md` keeps the frame and the step table;
`08-economy-ledger.md` carries H.1 and H.2.

## H.3 — earning: quest rewards, and end-of-round  ✅

**Done when** a claimed quest pays its reward in the transaction that marks it,
and a finished round pays a trickle in the transaction that grades it.

## Coins are not proportional to score, and that is the decision

A score-proportional reward pays more for an easy article — and a solo topic is
one the player chose, which is exactly the gameability that made G.5 keep solo
rounds off the leaderboards. Paying **by the round** is farmable only by
*playing*, which is bounded by time and is the behaviour the game wants.

Two per round, three more for a perfect one, and `coinsForRound` takes
`{ perfect }` rather than a round: the same boolean E.4's streak and F.1's
`perfect` qualifier use, so the three cannot disagree about the round they are
all describing.

**The calibration is held mechanically.** A perfect round must be worth less than
half the cheapest quest in the catalogue, because coins are meant to accumulate
from the retention loop — and a per-round trickle that rivalled a quest's reward
would make track F stop mattering.

## Where each credit is written

**The quest reward goes in the claim's transaction**, opened in the handler
rather than inside `claimQuest`, because it is that layer which knows the amount:
the reward is `QUEST_CATALOGUE`'s and `@wikifake/db` may not read it. F.6 was
re-cut to leave this boundary and H.1 built the ledger to accept a transaction;
this is where the two meet.

**The round's coins go in `recordSubmission`'s transaction**, beside E.4's
statistics and G.2's leaderboard entry. The amount travels with the grade as a
number, for the same reason `perfect` does.

**Guests earn nothing**, like quests: `coin_movement` cascades on `user_id` and
the anonymous plugin deletes that row the moment they sign up, so a guest's coins
would be coins that disappear. Their *round* still follows them — E.6 moves the
participant rows — so what they lose is the trickle, not the history.

## What the mutation run found, and it is mostly not what I expected

Four breakages. **One caught, three survived — and two of the three were right
to.** Recording that honestly is worth more than a tidier number:

- **coins made forty times larger** — caught, twice: the perfect-round case and
  the calibration against the cheapest quest.
- **the credit moved outside the claim's transaction** — survived. The order is
  still claim-then-credit, so nothing observable changes; what the transaction
  buys is that a *partial failure* cannot leave a claimed quest unpaid, and there
  is no honest way to force one from a test. The ledger's own participation in a
  caller's transaction *is* tested, in `coins.test.ts`, by throwing inside one and
  asserting nothing persists.
- **the credit moved before the claim** — survived, and correctly. Crediting
  first then failing the claim would commit the coins — except that the
  idempotency key is the quest, so the second claim's credit is a no-op. **The
  key makes the order within the transaction irrelevant**, which is a stronger
  position than relying on the ordering, and it is worth knowing that it holds.
- **the `userId != null` guard removed on the round credit** — survived, also
  correctly. `recordMovement` looks the player up before it writes, and
  `id = null` matches no row in SQL, so it returns null and writes nothing. The
  guard is defensive rather than load-bearing; it stays because it says what the
  rule is at the point the rule applies.

The pattern is F.6's already: **a rule that another layer also enforces cannot be
caught by mutating one of them.** The honest response is to say which layer is
the guarantee, not to add a test that pretends.

## And a test that claimed more than it did

The first version of the round's rollback case was named for a rollback and only
asserted the happy path — there was no failure planted anywhere. It was replaced
with one that tests what can actually be tested: a transaction that credits and
then throws leaves no coins. Naming a test for a property it does not exercise is
worse than not having it, because the next reader believes it.
