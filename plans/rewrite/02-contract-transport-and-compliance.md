# The contract to preserve — 2/2

> Cache and accounting, transport robustness, CC BY-SA compliance and
> indexing, deployment identity, documentation lock. The beginning of the
> contract — why it exists, the full index, server authority (C1), the
> scoring scale (C2), article generation (C3) and the known defects (D) — is
> in `01-contract-to-preserve.md`.

Same rules as the first half: every guarantee cost a bug in production, and
each one must have an equivalent test in the new stack before the Python is
deleted — the entry condition of phase 10. The identifiers are stable: the
phase files cite `C5.3` or `C7.2`, not "the JSON validation" or "the health
check".

## C4 — Cache and accounting

- **C4.1** — Normalised keys: "Paris", "paris", "  PARIS  ", "PÁRIS" are a
  single entry. Empty category ignored.
- **C4.2** — Entries **copied on the way in and on the way out**: mutating
  the result of a `get` affects nothing else.
- **C4.3** — TTL 6 hours, 3 variants per category, 200 categories in LRU.
- **C4.4** — Multiple variants served in rotation: the same search does not
  serve the same article forever.
- **C4.5** — A failed generation is neither cached nor counted.
- **C4.6** — `cache_hit_rate` and `per_generated_game` (cost per game
  actually generated, not diluted by the cache) stay exposed.

In the target, the cache moves to Redis with the same rules — it becomes
shared between instances and survives redeployments — and the volatile
counters of `usage.py` are replaced by the `llm_call` table, which makes the
cost per game queryable instead of starting from zero on every restart.

## C5 — Transport robustness

- **C5.1** — Nickname validated: non-empty, ≤ 24 characters, `^[\w\-. ]+$`,
  trimmed. Typed rejections (`invalid_name`), and the error message leaves
  **before** the close.
- **C5.2** — A connected duplicate name is refused (`name_taken`) without
  touching the player already in place.
- **C5.3** — Invalid JSON → `bad_json` and **the connection survives**.
  Unknown type → ignored.
- **C5.4** — Chat capped at 400 characters, empty chat dropped.
- **C5.5** — Cursors clamped to `[0,1]` and rate-limited server-side.
- **C5.6** — Unique 6-character room codes, creation capped (503 beyond).
- **C5.7** — Frames beyond 64,000 characters → close 1009.

In the target, the server throttle extends to `live_score` (defect D6) in
addition to `cursor`; the guarantees above remain the floor, not the ceiling.

## C6 — CC BY-SA compliance and indexing

- **C6.1** — **The CC BY-SA attribution is a tested legal requirement**:
  "deliberately modified text" + licence + link must stay visible **during
  and after** the round.
- **C6.2** — `robots.txt`: `Disallow /api /ws`, exclusion of GPTBot,
  ClaudeBot, Google-Extended, CCBot — the corpus is fake by construction, it
  must not train models. Sitemap declared.
- **C6.3** — `<html lang="fr">`, meta title/description within bounds, Open
  Graph, canonical.

## C7 — Deployment identity

- **C7.1** — `GET /ping` responds **exactly** `{"status": "alive"}`.
- **C7.2** — `GET /api/health` exposes `status`, `version`, `commit` (a
  string **present even when empty** locally), `commit_short`
  (7 characters), `model`, `llm_configured` (boolean). **The API key never
  appears.** The CI probe compares `commit` to the pushed SHA — this contract
  must survive the migration or the deployment verification loop dies in
  silence.
- **C7.3** — `GET /` always responds with HTML 200 and a non-empty
  `<title>`.

## C8 — The documentation ↔ code lock

- **C8.1** — The current guarantee: `test_architecture_doc.py` mechanically
  verifies that `plans/current-state/` does not drift — the cited modules
  exist, the `make` targets exist, the list of documented inbound WS messages
  **equals** the dispatch table, every documented outbound message is
  actually emitted, the documented routes **equal** the route decorators.
- **C8.2** — This mechanism is regex-based Python: **it must be
  reimplemented**, otherwise the guarantee disappears without a sound. In the
  target it becomes trivial and far more solid, since the protocol is a Zod
  object: the documentation is generated from the schemas, and the test
  compares the generated file to the committed one.

## How these guarantees are tested in the target

| Sections | Means of proof |
|---|---|
| C4 | Integration tests of the Redis cache and of billing (normalisation rules, TTL, LRU, rotation, uncounted failure) |
| C5 | Test WebSocket client against `apps/realtime`: duplicate-name refusal, surviving invalid JSON, throttles, bounds |
| C6 | Playwright E2E with negative and positive assertions: attribution visible during and after the round; tests on `robots.txt` and the metadata |
| C7 | Contract kept field for field, CI deployment probe ported as is |
| C8 | Doc generated from the Zod schemas, generated-vs-committed test |

The negative assertions (no truth text in the DOM during the round) are the
most important inheritance of the current project: they catch a solution leak
that no positive test would see.
