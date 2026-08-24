# Phase 4 — steps: the game's routes

> Steps 4.4 to 4.9. The phase sheet, its exit gate and where each step stands:
> `phase-04-api-and-auth.md`. The deployment probes:
> `phase-04-steps-probes.md`. Accounts and guests:
> `phase-04-steps-accounts.md`.

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
