# Track H — spending

The record of **H.4**. `08-economy.md` keeps the frame and the step table;
`08-economy-ledger.md` carries H.1 and H.2, `08-economy-earning.md` carries H.3.

## H.4 — spending: hints, against the existing billing  ✅

**Done when** a hint can be paid for in coins instead of score, in a solo round,
without a single rule of the hint mechanic changing.

## Solo only, and the reason is track G

The track says coins become *"a second currency for the same mechanic. Nothing
new in the domain."* That is nearly true, and the exception is what this step
turned on.

A hint paid for in coins leaves the score untouched. On a ranked board, that
means a player with coins outscores an identical player without — which is
pay-to-win in a game where the coins will one day be sellable, and it undoes the
step G.5 spent keeping the boards honest. So **the coin price is refused in a
room**, with `coins_not_accepted`, and offered in solo.

Solo is ranked nowhere (G.5), so no board is distorted by it. That is the
constraint held by construction rather than by watching for it: there is no
setting to get wrong and no report to read.

## The penalty was the wrong shape, and the test found it

`hintPenaltyFor(ledger)` priced **the levels held**. Every hint was paid for in
score, so the price of the record and the sum of the charges were the same
number — `hints.test.ts` had held the two to each other for a year.

Coins broke the tie. A coin-paid level is in the ledger, so the old definition
priced it; it charged the score nothing, so the player paid *twice*. The hint
response said zero and the debrief said fifty.

**The definition that survives is `hintPenaltyPaid`: the penalty is what was
taken.** It sums this table's `charged`, which is the same number as before
wherever score paid — the invariant test now asserts exactly that, on every
score-paid sequence — and zero for a hint the coins bought.

`hintPenaltyFor` stays, and is still right where it is used: the realtime room
holds a ledger and nothing else, and a room cannot pay in coins. One rule per
record, rather than one rule pretending to describe two.

**The test that caught it is the one that grades a round.** Everything about the
hint *response* passed while the recorded score was wrong, because the score is
recomputed at submission from the record. Two identical solo rounds, one hint
each, paid differently: the gap between the scores is the score price of a hint,
and the coin-paid round is the higher one.

## `paid_with`, not `charged = 0`

`hint_purchase` gained a column rather than having the currency inferred.

`charged = 0` already meant something — *the level was already owned* — so a
currency read off it would have called a re-bought hint coin-paid. The two facts
are different: what the score was charged, and what bought the hint.

The check that guarded the table is **widened, not dropped**. It read
`charged > 0`; it now reads *the score was charged, or the coins were*. A row
that charged neither is still refused, which is what it was protecting: a hint
nobody paid for.

Defaulted to `'score'`, so every row written before this step says what it meant.

## Both or neither

The purchase and the debit are one transaction. A debit without the purchase is
a coin taken for nothing; a purchase without the debit is a free hint.

The idempotency key is `hint:<participant>:<number>:<level>` — the level, so
that asking twice debits once, which the unique on `hint_purchase` decides
first and `coin_movement`'s key catches if the two requests raced. The balance
is checked *before* the write and refused with a sentence: H.1 deliberately has
no constraint against a negative balance, because an overdraft arriving as a
database error is an overdraft nobody can explain to a player.

## What this step did not do

The hint request carries `pay` as **optional**, not defaulted. A defaulted field
would have changed the shape every existing caller builds, and the absence of
the field is exactly what every existing caller means: score.

Nothing on a screen offers the coin price yet. The buying surface is H.7's, and
the mechanic it will call is finished and tested.

## Mutations that must go red

- The solo guard removed — a room buys a hint with coins.
- The balance check removed — a player with nothing buys a hint.
- The coin branch charging the score as well.
- The penalty pricing the ledger instead of the charges, at either the hint
  response or the grading.
