# Track H — the ledger

The record of **H.1**. `08-economy.md` keeps the frame and the step table — the
only place that says where a step stands.

## H.1 — `coin_movement`, the ledger, with idempotency  ✅

**Done when** a coin can be credited or spent exactly once per key, and a
balance is the sum of its movements rather than a column.

### One signed column, and no mutable balance anywhere

`amount` is signed — a credit is positive, a spend negative — rather than an
amount beside a direction, because two columns can disagree: a negative credit
is a row that means nothing, and no constraint would catch it without knowing
which of the two to trust. A sum over one column is the balance, with no `case`
in it.

**There is no balance column on `profile`, and that is what this track exists to
avoid.** The frame says why: the day a purchase is added, the questions asked are
*where did these coins come from*, *was this credit applied twice*, and *what
does this balance owe to a refund*. A ledger answers all three by existing.

### `balance_after` is safe only because of a lock

The plan asks for it, and it is the one denormalisation here. Two credits
arriving together would otherwise both read the same balance and both write the
same total — and **nothing is wrong with either row on its own**, which is why
reading one cannot catch it.

So `recordMovement` takes `select 1 from "user" where id = $1 for update` before
it computes anything. The granularity is exactly right: it serialises one
player's movements and no other player's. A table lock would serialise the game;
an advisory lock would be a second thing to remember.

A test runs ten credits over **four real connections** and asserts the ten
`balance_after` values are `10, 20 … 100` — a repeat means two movements read
the same balance. Removing the lock turns it red, and only that test sees it.

### The idempotency key is per player, not global

`(user_id, idempotency_key)`. Two players claiming the same quest on the same day
build the same key from what they know, and a global constraint would let the
first arrival silently deny the second. Making the constraint global turns five
cases red.

**A retry is answered with what happened, not with an error**, because a retry is
not a failure — it is the same request arriving twice. `fresh` says which it was,
so H.3 can tell a first payment from a replay without asking again. A retry
carrying a *different* amount gets the original one: that is a bug in the caller,
and the honest answer is still what the ledger did.

### `on conflict do nothing`, and the rewrite that taught it

The first version caught the unique violation and read the row back, which is
what `claimPseudonym` does. **It is wrong here, and the test found it:** a raised
error aborts the transaction it was raised in, so the read that follows fails
with *"current transaction is aborted"* and the retry gets an exception instead
of its answer.

`claimPseudonym` is correct because nothing calls it inside a transaction. This
function's whole purpose is to run inside one — H.3 credits a quest in the
transaction that marks it claimed — so it uses `on conflict`, which never raises.

### What is deliberately not enforced

**No check that a balance stays positive.** Whether a player may overdraw is a
rule about *spending* and it belongs to H.4, where refusing is a sentence a
player can act on. A constraint here would make an overdraft a database error on
a path that cannot explain itself, and would make a correction impossible to
record.

`adjustment` is in the source enum for the same reason: **a ledger with no way to
correct it is a ledger somebody corrects by hand**, and a hand-edited ledger is
one nobody can audit. Track I's panel will use it, through a row like any other.

### The enum, against the quest catalogue's text

`coin_source` is a `pgEnum` where `quest_assignment.rule_id` is `text`, and the
reason is the opposite one: the quest catalogue is *meant* to grow, and this list
is not. Adding a way for coins to come into existence should be a migration
somebody had to write.

### The mutation run

Three breakages, three caught: the lock removed (only the contention test), the
key made global (five cases), and `do nothing` turned into `do update` (three,
including the retry storm).

## H.2 — balance as a derived read, and its index  ✅

**Done when** a balance is one row rather than a sum, the two agree on a ledger
of thousands, and the read is held to its index.

### `created_at` cannot order a ledger, and `seq` is why

**`now()` is the transaction's start time, not the clock's** — verified against
Postgres rather than assumed — so two movements written in one transaction carry
the *identical* `created_at`. That is the ordinary case and not a rare one: H.3
credits a quest inside the transaction that marks it claimed, and H.4 will spend
inside the one that bills a hint.

A balance read taking "the newest row" would then be choosing between two rows
at random, and could return the **earlier** balance. `seq`, a `bigserial`, makes
the order total whatever the clock says. The history reads by `created_at` *and*
`seq`, so a spend never appears above the credit that paid for it.

Global rather than per player: one sequence Postgres maintains against a second
thing to lock. The gaps a rolled-back transaction leaves do not matter, because
nothing reads the value — only its order.

### The finding: an index that could not be used

The first measurement said **`balance_after` buys nothing** — summing five
thousand movements was *faster* than reading one row, and the planner would not
touch the index. Both were true, and the reason was not the size of the table.

**`order by x desc` means `desc nulls first` in SQL.** Drizzle's `.desc()` writes
`DESC NULLS LAST` into an index and a bare `desc` into an order by, so they do
not match and Postgres cannot use the index for the ordering at all:

```
order by seq desc              cost 139    0.77 ms   Seq Scan + top-N sort
order by seq desc nulls last   cost 0.35   0.08 ms   Index Scan, stops at row 1
```

Ten times faster, constant rather than linear, and chosen by the planner without
being forced. The columns are `not null`, so the two orderings **can never differ
in result** — only in whether an index may be used, which is exactly why nothing
caught it.

`newestFirst` in `queries/coins.ts` spells it, and the volume test asserts the
plan so it cannot regress. The case that used to assert a sequential scan now
asserts the index, and keeps the story: *a measurement that says an index is not
worth using is sometimes a measurement of an index that cannot be used.*

**It applies beyond this step**, and a probe proved one: giving the leaderboard's
`score desc` the same clause took the all-time board from **45 ms to 26 ms** at
fifty thousand entries, with all fourteen of G.4's cases still passing. Reverted
and recorded — a performance change to a shipped step is not an aside in a step
about a ledger. `../current-state/09-query-debt.md` carries it, and that register
is new because the other three had all reached their cap.

### Two reads, held to each other

`selectBalance` takes one row; `sumBalance` adds up every movement. The sum is
the *definition*, so if they ever disagree the fast one is wrong — and the volume
test asserts they agree on an account with five thousand movements whose amounts
alternate sign, because a sum that agreed with a monotonic ledger might be adding
absolute values.

A second account is seeded alongside, so "this player's balance" has something to
be narrowed from: an index that ignored `user_id` would pass on one account.
