# Phase 4 — API and authentication

| | |
|---|---|
| **State** | in progress |
| **Branch** | `feat/rewrite-phase-4` |
| **Depends on** | phase 3 |
| **Delivers** | the solo game's REST API and Better Auth, guests included |

## Objective

Expose the Next.js route handlers in `apps/web` — `/ping`, `/api/health`,
`/api/usage`, `/api/game/{start,hint,scan,submit}`,
`/api/multiplayer/create`, `/api/flag-report` — and set up Better Auth with
guest sessions attachable to an account created afterwards. On exit, a solo
game plays end to end through the API, with or without an account.

## Why now

The bricks exist: contracts (phase 1), database (phase 2), article
(phase 3). The API assembles them without re-deciding anything. It precedes
real-time and the UI, which will consume the same contracts. Auth lands in
the same phase because every game route must know its participant — account
**or** guest — from the moment it is written, not be reopened afterwards.
And playing without an account must stay possible: that is what keeps the
game alive.

## Steps

Nine steps, so the definitions live in three sheets: the probes that say what
is deployed, the ones that establish who is asking, and the ones that answer
game questions. **The tables below are the
only place that says where a step stands** — the sheets define the work and its
completion criterion, and carry no state.

| # | Step — the deployment probes | State |
|---|---|---|
| 4.1 | `/ping` and `/api/health` field by field | ✅ done |

Definitions: `phase-04-steps-probes.md`.

| # | Step — accounts and guests | State |
|---|---|---|
| 4.2 | Better Auth | ✅ done |
| 4.3 | Attachable guest sessions | ✅ done |

Definitions: `phase-04-steps-accounts.md`.

| # | Step — the game's routes | State |
|---|---|---|
| 4.4 | `POST /api/game/start` | ✅ done |
| 4.5 | `POST /api/game/hint` and `POST /api/game/scan` | ✅ done |
| 4.6 | `POST /api/game/submit` | ✅ done |
| 4.7 | `GET /api/usage` | ✅ done |
| 4.8 | `POST /api/multiplayer/create` | ✅ done |
| 4.9 | `POST /api/flag-report` | to do |

Definitions: `phase-04-steps-game.md`.

4.1 creates `apps/web` itself — phase 0 left the `apps/` tree "empty but
declared" — so it comes first whatever else is urgent. Auth is 4.2 and 4.3
rather than a later phase because every game route has to accept a guest from
the moment it is written.

## Exit gate

- All the §3.1 invariants (server authority) on solo, tested through the
  API.
- `/api/health` contract preserved field by field; `/ping` responds exactly
  `{"status": "alive"}`.
- A guest game attaches to an account created afterwards.
- A solo game plays end to end through the API, without UI.

## Contract touched

See `01-contract-to-preserve.md`: **server authority** (§3.1 — the solution
does not leave the server, server-side score, monotonic hints, server-side
SCANNER), **the scoring** (§3.2 — reference case via `submit`), **cache and
accounting** (§3.4 — `cache_hit_rate` and `per_generated_game` on
`/api/usage`) and **deployment identity** (§3.7 — `/ping` and
`/api/health`).

## Pitfalls

- **The deployment probe dies silently** if `/api/health` changes by one
  field: `commit` present even when empty, `commit_short` exactly 7
  characters, `llm_configured` boolean — not "roughly the same".
- Test the solution leak **by values**, not only by keys: renaming a key is
  enough to fool a key-based test.
- Guest is not a degraded mode: every game route accepts a guest participant
  from the moment it is written, not through a workaround bolted on at the
  end.
- No in-memory state: the solo session lives in the database. A restart or a
  second instance must lose nothing — that is what the old backend could not
  do.
- The scoring is not copied into the handlers: it lives in
  `packages/domain`, the API calls it. That is the truth duplication the
  rewrite is meant to close.
