# Track H — the seam a purchase would attach to

The record of **H.8**, and the thing itself. `08-economy.md` keeps the frame and
the step table; the other five sheets carry H.1 to H.7.

## H.8 — the seam, documented not built  ✅

**Done when** somebody deciding whether to sell coins can cost that decision
from this page instead of discovering it.

**It is documentation, not an abstraction layer.** Building an interface for a
payment provider nobody has chosen is how this track doubles in size for
nothing, and an unused abstraction is worse than none: it constrains the choice
it was built to keep open. `economy-seam.test.ts` is what keeps the *absence*
honest — see the last section.

## Where a purchase attaches: one movement, one source

A pack of coins bought with money is **one `coin_movement`** with a source this
table does not have yet:

| | |
|---|---|
| `source` | `top_up` — a sixth member of `coinSourceEnum`, one migration |
| `amount` | positive, the coins credited |
| `reference` | the provider's own payment identifier |
| `idempotency_key` | `topup:<provider payment id>` |
| `balance_after` | written under the lock, like every other movement |

That is the whole insertion point, and it is one call to `recordMovement`. The
ledger was built for this in H.1 and nothing about it changes: **a balance is
still the sum of its movements**, a top-up is still a row, and *where did these
coins come from* is still answerable.

**Why the enum and not `adjustment`.** `adjustment` exists for a correction made
by a person. Money is not a correction, and a top-up filed under it would be
indistinguishable from an apology — which is exactly the question an accountant
asks first. The enum being a migration is the feature: adding a way for coins to
come into existence should be a change somebody had to write down.

## Idempotency is already the hard part, and it is already solved

A payment webhook arrives more than once. That is not an edge case — it is how
every provider works, because at-least-once delivery is the only kind they can
promise.

`unique(user_id, idempotency_key)` makes a repeat credit **impossible rather
than unlikely**, and `recordMovement` returns `fresh: false` for it rather than
raising, so a second webhook is answered `200` and nothing is credited twice.
`onConflictDoNothing` and not a caught violation, which H.1 learned the hard
way: a raised error aborts the transaction it was raised in.

**The key must be the provider's identifier, not ours.** A key we mint is a key
that differs between the request that timed out and the retry that followed it.

## Where a refund reverses

A refund is **a second movement, negative, and never a deletion**:

```
source            = 'top_up'
amount            = -(what was credited)
reference         = the provider's refund identifier
idempotency_key   = 'refund:<provider refund id>'
```

Deleting the original row would make the ledger disagree with the provider's
records and destroy the only evidence of what happened. Two rows that sum to
zero is what a refund *is*.

**The balance can go negative, and H.1 chose that deliberately.** There is no
constraint against it, precisely so that a refund of coins already spent is
recordable rather than a database error on a webhook. What happens next is a
policy question — let it ride, or refuse purchases until it clears — and the
policy belongs to whoever sells the coins. The ledger's job is to be able to say
it happened.

This is also why **H.7 made buying not wear**: a refund reverses one movement,
and if a purchase had also changed a worn column there would be a second thing
to undo, with no row saying it needed undoing.

## What a receipt would need

Nothing in this schema is a receipt, and the gap is not accidental.

A receipt needs the **money**, and `coin_movement` records only coins: no
currency, no amount in it, no tax rate, no seller identity, no timestamp with a
legal meaning. The provider holds all of that, and the `reference` column is the
link to it.

That is the recommended split rather than an omission: a fiscal document has
retention rules, correction rules and a format, and the provider is in that
business. What this repository would add, if it sold anything, is a **receipts
table of its own** — provider, payment id, the money as minor units plus an ISO
currency code, the tax the provider calculated, and a link to the movement that
credited the coins. One row per payment, immutable, never a join away from the
ledger.

## What is not handled, and would have to be

Named so that none of it is a discovery:

- **VAT.** Digital goods are taxed where the buyer is, not where the seller is.
  That is a rate per country, evidence of where the buyer was, and a return to
  file. G.1's `derived_region` is a CDN header and is **not** evidence of
  residence for tax purposes — it is a network fact, and the plan says so.
- **Invoicing.** Some buyers are entitled to a document with a sequential
  number. A sequence with gaps in it fails an audit, and nothing here mints one.
- **Chargebacks.** A reversal decided months later by a bank, against coins long
  since spent. The negative movement above records it; the *policy* does not
  exist.
- **Minors.** A game of critical reading has young players, and selling to a
  child engages consumer-protection law well beyond a checkout: age assurance,
  parental consent, and a right of withdrawal. This is the largest of the five
  and the least technical.
- **Currency and pricing.** Coins have a price in coins. A price in money is a
  number per market, and changing it is a change to a published offer.

## What this step deliberately did not do

No provider chosen, no SDK, no checkout, no `top_up` member, no receipts table,
no price in currency. **The exit gate says "no payment code anywhere in the
diff", and this step is where that becomes checkable rather than asserted.**

`packages/config/src/economy-seam.test.ts` sweeps every source file under
`apps/`, `packages/` and `scripts/` for payment vocabulary — provider names,
`checkout_session`, `payment_intent`, card and bank details, a VAT rate, an
invoice number, a price in currency — and fails if one appears outside its own
comments.

**A whole-repository sweep rather than a list of files to watch**, for the reason
H.5's catalogue guard gives: a list of guarded files is a list the next
integration is not on. The exemption list has exactly one entry, the test
itself, and a test asserts it stays one — an exemption list is how a guard like
this gets switched off a file at a time.

**The plans are not searched, and that is not a loophole.** A markdown file
naming a provider is a plan saying *not that one*: `08-economy.md` says "No
Stripe, no price in euros, no checkout" and `plans/rewrite/00-overview.md` puts
monetisation out of scope. Searching prose would flag exactly the documents that
ruled it out — `purity.test.ts`'s comment problem, in a format with no comments.
The gate is about code.

The patterns are deliberately narrow. *Charge* is already everywhere — a hint is
charged to the score — and a pattern that flagged it is a pattern somebody
switches off. A last case points the patterns at a planted
`new Stripe(...)` and at `charged: 0`, so a search that had stopped matching
anything would fail rather than report a clean sweep.
