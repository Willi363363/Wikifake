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
