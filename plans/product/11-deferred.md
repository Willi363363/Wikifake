# Deferred — decided against, for now

The value of this file is that these are **decisions with reasons**, not
oversights. Anybody proposing one of them later starts from the argument
rather than from scratch.

## Advertising

**Deferred until the rest is clean** — the owner's own condition, and the
arithmetic supports it.

Display advertising on a game of this kind pays roughly €1–3 per thousand
impressions. At that rate, meaningful revenue needs traffic in the hundreds of
thousands of monthly page views. Until then, ads cost more than they earn:
they slow the first paint, they require a certified consent platform in
Europe, they force a cookie banner in front of every first-time visitor, and
they make the privacy policy substantially longer.

**The order is not negotiable**: traffic first, ads second. A game with ads and
no players earns nothing and looks worse.

When it happens: a section in the admin panel (track I), a consent platform,
and a policy update. Not before there is traffic worth measuring.

## Real payments

**Deferred.** Track H builds a coin ledger shaped so a purchase can attach to
it, and stops there — H.8 documents the seam.

What a real purchase actually costs, so the estimate is honest: a payment
provider, European VAT via the OSS scheme, invoices and receipts, refunds and
chargebacks, a minors policy, and terms that survive a dispute. That is a
project comparable in size to several tracks of this effort combined, and it
is worth starting only against evidence that players want to spend.

## Supabase

**Refused, 2026-09-05.** The proposal was Supabase for the database and Google
sign-in. Both already exist: Postgres with Drizzle, and `better-auth` with
Google and GitHub wired and waiting on credentials.

Migrating would mean rewriting the schema, the auth layer and the tests that
lock them — for no capability the project does not have. Revisit only against
a specific need Supabase answers and the current stack does not; storage for
user-uploaded files is the plausible one, and it can be added alone.

## Seasons and a content calendar

**Refused by design.** A season implies somebody produces content on a
schedule, and the owner's requirement is an application that runs unattended.
Track F's quests are generated from a rule catalogue for exactly this reason.

If seasons ever return, they must be generated too — a season that needs
writing is a subscription to unpaid work.

## Heavy anti-cheat

**Deferred.** Server-side grading and scoring already exist; track G ranks
only finished, server-graded rounds. Replay validation and outlier detection
are disproportionate until cheating is worth somebody's time.

## AI-generated marketing video

Out of scope for `plans/`, because it touches no code. Generating short video
with a model and running it on TikTok and Meta is a marketing activity, and it
belongs wherever marketing is planned — not in the repository's technical
documentation.

One technical dependency worth noting if it happens: a social share image and
open-graph tags, which are track C step C.8 and track J step J.2.

## Native mobile applications

Never raised, recorded pre-emptively because it always comes up. The game is a
responsive web application and works on a phone. A native shell adds two store
review processes and a release cycle, and buys nothing this game needs.
