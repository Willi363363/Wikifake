# Phase 4 — API and authentication

| | |
|---|---|
| **State** | to do |
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

### 4.1 — `/ping` and `/api/health` field by field

`GET /ping` responds with **exactly** `{"status": "alive"}`. `GET /api/health`
exposes `status`, `version`, `commit` (string present even when empty
locally), `commit_short` (7 characters), `model`, `llm_configured`
(boolean). The API key never appears. The CI probe compares `commit` to the
pushed SHA: this contract must survive field by field, or the deployment
verification loop dies silently.

**Done when**: a test compares the response field by field, including the
locally empty `commit` case, and a by-values test checks that the API key
does not appear in the serialised JSON.

### 4.2 — Better Auth

Better Auth in the project's Postgres: `user`, `session`, `account`,
`verification` tables (phase 2 schema), OAuth, `/api/auth/*` routes mounted
in `apps/web`.

**Done when**: creating an account, opening then closing a session work in
an integration test against the database.

### 4.3 — Attachable guest sessions

Playing without an account: `participant` references an account **or** a
guest. A game played as a guest attaches to an account created afterwards —
that is the exit gate of batch 5 of the source plan.

**Done when**: in an integration test, a game played as a guest appears in
the history of the account created afterwards.

### 4.4 — `POST /api/game/start`

The article comes from `packages/article`; the game is written to the
database (`game`, `game_position`, `participant`). The payload contains the
article and the **count** of falsified paragraphs. Never which ones, never
the explanations, never the hints, never `original_text`.

**Done when**: a test checks **by keys and by values** that no truth text or
hint appears in the serialised JSON of the response.

### 4.5 — `POST /api/game/hint` and `POST /api/game/scan`

Hints billed on call, monotonic levels billed exactly once: level 2 unlocked
then level 1 requested again returns level 2; repeating level 2 does not
re-bill. A hint's text is never transmitted before payment; each purchase
writes a `hint_purchase` row. SCANNER is resolved server-side: a real fake
not yet designated, remembered per player, `null` when none remain.

**Done when**: the monotonicity and no-re-billing cases of §3.1 pass through
the API, and `scan` returns `null` after exhaustion.

### 4.6 — `POST /api/game/submit`

The score is computed by the server from its own state, with the scoring
from `packages/domain`. Penalties declared by the client are ignored:
`hintsUsed: 9`, `hintPenalty: 9999`, `scoreStolen: -100000` produce a
breakdown of zero. The complete solution arrives with the response, not
before.

**Done when**: the scoring reference case (`tp=3, fp=1, penalty=20,
stolen=50, 200 s left out of 300 → 400`) passes through the API, and
client-declared penalties have no effect on the breakdown.

### 4.7 — `GET /api/usage`

From `llm_call` in the database: `cache_hit_rate` and `per_generated_game`
stay exposed. Today the counters restart from zero on every restart; in the
database, they survive.

**Done when**: after generations in an integration test, both measures are
exact and identical after a restart of the handler.

### 4.8 — `POST /api/multiplayer/create`

Unique 6-character room codes, creation capped (503 beyond), room written to
the database (`room`). The real-time service that will drive it comes in the
next phase.

**Done when**: two creations yield distinct 6-character codes, and hitting
the cap returns 503 in a test.

### 4.9 — `POST /api/flag-report`

Replaces `complaints.jsonl`: report and model verdict in the `flag_report`
table. The checker queries Wikipedia with the explicit language from
phase 3, never global state.

**Done when**: a report in a test writes a complete `flag_report` row, and
nothing is written to disk.

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
