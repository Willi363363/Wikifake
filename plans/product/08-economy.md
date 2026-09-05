# Track H — coins and the shop

| | |
|---|---|
| **State** | ⬜ not started |
| **Branch** | `feat/economy` |
| **Depends on** | tracks E and F |
| **Delivers** | a coin ledger, a shop, and no payment |

## Objective

Coins earned from quests and good play, spent on hints and cosmetics. **No
real money in this track** — the decision was: build the ledger now, shaped so
that a purchase can be added later without rewriting it.

## Earned only, purchase-ready

The distinction that makes this worth doing carefully:

- **Nothing here takes a payment.** No Stripe, no price in euros, no checkout.
  The shop sells for coins, and coins come from playing.
- **The ledger is built as if it would.** Every movement is a row with a
  source, an amount, a balance after, and an idempotency key. A balance is
  never a mutable integer on the profile — it is the sum of its movements.

Why that shape, when nothing is being sold yet: the day a purchase is added,
the questions asked are *where did these coins come from*, *was this credit
applied twice*, *what does this player's balance owe to a refund*. A ledger
answers all three by existing. A counter on a row answers none, and converting
one into the other after the fact means reconstructing history that was never
recorded. The extra cost today is one table and one constraint.

**A wallet with a mutable balance column is the thing this track exists to
avoid.**

## What coins buy

Two categories, and the boundary between them is a design rule:

- **Hints** — the game already sells hints, already bills them server-side and
  already refuses to bill one twice. Coins become a second currency for the
  same mechanic. Nothing new in the domain.
- **Cosmetics** — a token colour, a marker style, a profile frame. Chosen
  because they cannot affect a round.

**Nothing bought with coins may change a player's chance of winning**, beyond
the hints the game already prices for everybody. The moment a purchase does,
the leaderboard stops measuring skill and a future paid currency becomes
pay-to-win — which is both a worse game and a much harder thing to sell.

## Steps

| # | Step | State |
|---|---|---|
| H.1 | `coin_movement` — the ledger, with idempotency | ⬜ |
| H.2 | Balance as a derived read, and its index | ⬜ |
| H.3 | Earning: quest rewards, and end-of-round | ⬜ |
| H.4 | Spending: hints, against the existing billing | ⬜ |
| H.5 | The cosmetics catalogue, in `domain` | ⬜ |
| H.6 | Ownership, and applying a cosmetic | ⬜ |
| H.7 | The shop screen | ⬜ |
| H.8 | The seam a purchase would attach to, documented not built | ⬜ |

### H.8 — The seam

One short document, written while the design is fresh: which movement source a
purchase would use, where a refund reverses, what a receipt would need, and
what is *not* handled (VAT, invoicing, chargebacks, minors). It exists so that
the decision to sell coins is later a costed decision rather than a discovery.

It is documentation, not an abstraction layer. Building an interface for a
payment provider nobody has chosen is how this track doubles in size for
nothing.

## Exit gate

- Every coin in existence is explained by a ledger row.
- The same credit applied twice with one idempotency key credits once.
- A balance read matches the sum of movements, on a seeded account with
  thousands of them.
- No purchasable item changes a round's outcome.
- No payment code, no price in currency, anywhere in the diff.
