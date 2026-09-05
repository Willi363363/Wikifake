# Track I — the admin panel

| | |
|---|---|
| **State** | ⬜ not started |
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
| I.1 | An admin role, and a route only it reaches | ⬜ |
| I.2 | Health section, from the existing probes | ⬜ |
| I.3 | Players and activity | ⬜ |
| I.4 | Activation and return | ⬜ |
| I.5 | Games, and the abandon rate | ⬜ |
| I.6 | Cost, from `llm_call` | ⬜ |
| I.7 | Content and cache | ⬜ |
| I.8 | A date range, applied across every section | ⬜ |

### I.1 — The role

A flag on the account, set by a migration, not by a screen. The route returns
404 rather than 403 to anybody else — an admin route that announces itself is
a target, and there is no reason to confirm it exists.

## Exit gate

- Every figure traces to a query somebody can read, with no in-memory maths
  that a second implementation could disagree with.
- A non-admin gets a 404, signed in or not.
- The panel loads in under a second on the current data volume.
- No write, no mutation, no destructive action anywhere in the diff.
