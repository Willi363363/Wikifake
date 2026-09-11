# Track I — the admin panel

| | |
|---|---|
| **State** | ✅ I.1 to I.8 — a read-only panel, with a range across it |
| **Branch** | `feat/admin-panel` |
| **Depends on** | track E |
| **Delivers** | a read-only view of the application's health |

## Objective

One place to see whether the game is alive: who plays, how much it costs, and
whether people come back. **Read-only in this track.**

## Why read-only, and why that is not a compromise

An admin panel that can act on data is a second application — permissions,
audit trails, confirmation flows, and a blast radius. An admin panel that only
reads is a set of queries and a page.

The reading version answers every question actually being asked right now, and
the acting version answers none of them, because nobody has yet needed to ban
a user or refund anything. Write actions go in when there is a case for a
specific one.

## What it reads already exists

This is the cheap track, and the reason is that the rewrite instrumented the
expensive parts before anybody asked for a dashboard:

- **`llm_call`** records every model call, working or not, and phase 4 shipped
  *what a game costs, from the rows*. Cost per game is a query, not a project.
- **`usage`** and **`audit`** carry the game-level events.
- **`player_stats`** from track E carries last-seen and finished-versus-started
  — the two fields the activation figure needs, which is why track E names
  them rather than this one inventing a parallel definition.

## The sections

| Section | What it answers |
|---|---|
| Health | Are both services up, on which commit, and how slow |
| Players | Signed up, active today and this week, and the most active |
| Activation | Of the accounts created, how many played a game — and how many came back after it |
| Games | Started, finished, abandoned, and the abandon rate by screen |
| Cost | Model spend per day, per game, and per player |
| Content | Which articles are drawn, cache hit rate, generation failures |

**Activation is the number worth building this for.** Everything else is
vanity — accounts created goes up and means nothing. The ratio of people who
signed up to people who played, and of people who played once to people who
played twice, is the one figure that says whether the game works.

## Retention beats revenue, at this size

The plan that started this effort wanted revenue KPIs. They are deliberately
absent: there is no revenue, and a dashboard that displays zero in six ways
teaches nothing. The advertising arithmetic — and why it stays a rounding
error until the traffic is very different — is in `11-deferred.md`. When there
is money, this panel gets a section; not before.

## Steps

| # | Step | State |
|---|---|---|
| I.1 | An admin role, and a route only it reaches | ✅ |
| I.2 | Health section, from the existing probes | ✅ |
| I.3 | Players and activity | ✅ |
| I.4 | Activation and return | ✅ |
| I.5 | Games, and the abandon rate | ✅ |
| I.6 | Cost, from `llm_call` | ✅ |
| I.7 | Content and cache | ✅ |
| I.8 | A date range, applied across every section | ✅ |

### I.1 — The role

A flag on the account, set by a migration, not by a screen. The route returns
404 rather than 403 to anybody else — an admin route that announces itself is
a target, and there is no reason to confirm it exists.

**Built, and what it decided is in `09-admin-role.md`**: a table rather than a
column on Better Auth's `user`, the account's own id as its primary key, no code
anywhere that writes it, and an empty table as the safe default.

### I.2 — Health

**Built, and in `09-admin-health.md`**: nothing new instrumented, a failure is a
value rather than an exception, and the figure the section is really for — do
the two services agree about what is deployed, with *unknown* kept distinct from
*disagreeing*.

### I.8 — The range

**Built, and in `09-admin-range.md`**: the panel reads events, cohorts and
running totals, and only the first two can be ranged — so the most-active list
and the health probes say they are not, and the chooser names which sections it
moves. A range that silently left a third of the screen alone would be a range
that lied.

### I.7 — Content

**Built, and in `09-admin-content.md`**: the cache hit rate leads because it
decides the cost section, a topic's plays sit beside its cache hits because the
totals alone cannot tell a working cache from a missing one, and the two kinds
of generation failure are kept apart — a topic nobody can find is not a fault.

### I.6 — Cost

**Built, and in `09-admin-cost.md`**: tokens are recorded and money is a rate a
deployment opts into, because one written into the source would go stale
without saying. Both halves of the rate or neither, cached games out of the
denominator, and failed calls counted — they spent the tokens.

### I.5 — Games

**Built, and in `09-admin-games.md`**: the track's *by screen* is unanswerable —
the screens before a round exists leave no row — so the split is by mode, and
the rate counts only rounds that have ended, because a seat in a running round
has abandoned nothing.

### I.4 — Activation

**Built, and in `09-admin-activation.md`**: one query for a four-step funnel
whose nesting is asserted, *coming back* as a later day rather than a second
round, and `null` kept distinct from nought per cent — a panel reading 0% the
day before launch would report a failure that has not happened.

### I.3 — Players

**Built, and in `09-admin-players.md`**: a guest is a `user` row, so `count(*)`
is not "signed up"; *today* is `periodWindowOf`'s day, the same one a daily
quest uses; and two new indexes, each proved by dropping it and watching the
plan turn into a scan.

## Exit gate

All four hold, and each names what holds it:

- **Every figure traces to a query somebody can read.** Counts are
  `count(…) filter (where …)`; the only arithmetic in TypeScript is `shareOf`,
  one division with one implementation, and `spendOf`, which multiplies tokens
  by a configured rate.
- **A non-admin gets a 404, signed in or not.** `requireAdmin` answers the same
  404 to no session, a guest, an account without the grant and a cookie that is
  not one — and a test reads every route file to check it is called, and that
  none of them redirects.
- **The panel loads in under a second on the current data volume.** The two
  reads that touch every account are index-served, each proved by dropping the
  index and watching the plan turn into a scan on five thousand rows.
- **No write, no mutation, no destructive action anywhere in the diff.** A
  sweep reads every source under `src/admin/` for `.insert(`, `.update(`,
  `.delete(` and a `POST`, and fails on any of them.
