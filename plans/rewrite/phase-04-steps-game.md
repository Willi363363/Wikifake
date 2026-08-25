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

Three decisions taken while writing it:

- **The session handle is the game's identifier.** Not a bearer token: the
  routes that follow authorise on the session cookie — is this caller a
  participant of that game — which is what `secrets.token_urlsafe(12)` was
  standing in for, from an in-memory registry a restart emptied.
- **The generator now carries `original_text`.** `game_position.original_text`
  is `not null` and nothing produced it: phase 3 dropped the paragraph the
  model replaced, and the cache dropped it a second time. Both now keep it, so
  a round served from the cache is recorded exactly like a generated one. It
  travels nowhere — every wire schema is built on `falsifiedPosition`, which
  has no such field, so Zod strips it on the way out.
- **A refused body answers `bad_json`, 400.** The union of error codes is
  closed and has no member for "this route cannot read your request"; `bad_json`
  is the one that means it. `topic_not_found` is 404, `generation_failed` 502 —
  what failed there is upstream, and the difference tells a client whether
  retrying the same topic is worth anything.

**Done when**: a test checks **by keys and by values** that no truth text or
hint appears in the serialised JSON of the response.

### 4.5 — `POST /api/game/hint` and `POST /api/game/scan`

Hints billed on call, monotonic levels billed exactly once: level 2 unlocked
then level 1 requested again returns level 2; repeating level 2 does not
re-bill. A hint's text is never transmitted before payment; each purchase
writes a `hint_purchase` row. SCANNER is resolved server-side: a real fake
not yet designated, remembered per player, `null` when none remain.

Three decisions taken while writing it:

- **Nothing is held between requests.** The ledger is rebuilt from the
  `hint_purchase` rows on every call — `ledgerFrom` in `@wikifake/domain` —
  because the current server keeps it in a dictionary in a process, so a
  restart hands the player back every hint they paid for. A second row for a
  level already billed does not land and says so, which is the honest answer
  to a double-click: the player owns it, and is served it for free.
- **`item_use` gained `paragraph_index`.** The SCANNER answers with the lowest
  falsified paragraph the player has neither marked nor already been shown, so
  what it may answer next depends on what it answered before — and a count of
  uses cannot be replayed into that list, because the marks it was compared
  against are gone. A unique constraint on (caster, item, paragraph) makes
  "remembered per player" a property of the schema rather than of a handler.
- **Authorisation is the cookie, never the handle.** The session handle is the
  game's identifier and is not a secret; what decides is whether the caller has
  a `participant` row in that game. No session, no such game, somebody else's
  game and a round that is over all answer the same `session_not_found`, so the
  refusal cannot be used to ask whether a game exists.

Left open: `sessionId` in the contract is still any URL-safe string of 16 to 64
characters, written for `secrets.token_urlsafe(12)`. The handle is a uuid since
4.4, so the routes check the shape before querying. Narrowing the schema is a
protocol decision and belongs to a step that owns the protocol.

**Done when**: the monotonicity and no-re-billing cases of §3.1 pass through
the API, and `scan` returns `null` after exhaustion.

### 4.6 — `POST /api/game/submit`

The score is computed by the server from its own state, with the scoring
from `packages/domain`. Penalties declared by the client are ignored:
`hintsUsed: 9`, `hintPenalty: 9999`, `scoreStolen: -100000` produce a
breakdown of zero. The complete solution arrives with the response, not
before.

Two decisions taken while writing it:

- **Submission is idempotent.** A second submission hands back the grading that
  landed rather than grading again: the clock has moved, so regrading would
  quietly replace a player's score with a smaller one. The update is conditional
  on `submitted_at` still being null, so two submissions racing produce one
  grading and the loser is told.
- **Solo ends on the submission.** `game.ended_at` is set here because solo has
  one player. Multiplayer ends on the last submission or on the timer, and that
  belongs to the reducer in phase 5.

**On the reference case**: two of its terms cannot be produced through the solo
API. A hint costs 50 or 200, never 20, and nothing steals points when there is
no rival. C2.5 stays pinned in `packages/domain/src/scoring.test.ts`; what the
API test pins is the same scale on terms a solo round can reach — `tp=3, fp=1`,
one nudge, 200 s left of 300 → 420 — plus the total agreeing with the breakdown
it reports.

**Done when**: the scoring scale passes through the API, and client-declared
penalties have no effect on the breakdown.

### 4.7 — `GET /api/usage`

From `llm_call` in the database: `cache_hit_rate` and `per_generated_game`
stay exposed. Today the counters restart from zero on every restart; in the
database, they survive.

Two decisions taken while writing it:

- **`cache` became nullable in the contract.** An outage is not an empty cache.
  The current cache is a dictionary in the process and always answers; the
  shared one can be unreachable, and phase 3 kept `unavailable` distinct from a
  miss for exactly this reason. Serving `articles: 0` instead would read as
  "the cache is empty, generation is expensive" — a wrong answer to the one
  question this endpoint settles. The documentation lock caught the change, as
  it is meant to.
- **`byKind.calls` counts successes only.** `usage.py` counts a failure as a
  call, so its `calls` and its token totals describe different populations and
  the cost per game is computed from the larger one. C4.5 says a call that
  failed bought nothing; failures keep their own field beside it.

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
