# Phase 2 — Data

| | |
|---|---|
| **State** | to do |
| **Branch** | `feat/rewrite-phase-2` |
| **Depends on** | phase 1 |
| **Delivers** | `packages/db`: migrated Drizzle schema, typed client, seed |

## Objective

Lay down persistence: the Drizzle schema on Postgres Neon — the fourteen
tables described step by step below —, the migrations, the typed client and
a development seed. No business logic: the rules stay in `domain`.

## Why now

Everything that writes comes right after: article counters (phase 3), API
(phase 4), accounts (phase 5). The schema builds on the phase 1 types so as
not to redeclare the shapes. And it is the `llm_call` table that replaces
the volatile counters of `usage.py`: today `/api/usage` restarts from zero
on every restart, which makes any real cost measurement impossible. In the
database, the cost per game becomes a query.

## Steps

### ✅ 2.1 — Drizzle tooling and client

`drizzle-kit`, configuration, Neon client exported exactly once.
`DATABASE_URL` goes through the typed environment of phase 0.

Delivered with 2.2, because the first half of its criterion needs a table to
migrate: `drizzle-kit migrate` on an empty schema does nothing and proves
nothing. One driver for every environment — `postgres.js` speaks what Neon
serves over TCP and what a container serves in a test, so the code that runs in
production is the code the tests exercise.

**Done when**: `drizzle-kit migrate` runs on a fresh database, and starting
without `DATABASE_URL` fails while naming the variable.

### ✅ 2.2 — Authentication and profile tables

`user`, `session`, `account`, `verification` in the format expected by
Better Auth (wired in phase 5), plus `profile`: display name, preferred
accent, preferences.

**Done when**: the migration passes, and an integration test inserts then
reads back a `user` and its `profile` in a typed way.

### ✅ 2.3 — Game tables

`room` (code, host, settings, state, timestamps), `game` (solo/multi mode,
topic, source URL, article snapshot, count of fakes), `game_position`
— **the solution**: index, fake text, original text, explanation, hint —,
`participant` (account **or** guest, colour, score, tp, fp, hints, penalty,
stolen, time bonus), `answer` (marked paragraphs).

**Done when**: an integration test inserts a complete game
(room → game → positions → participants → answers) and reads it back typed,
and the exported "game in progress" read queries never join
`game_position`.

### ✅ 2.4 — Audit tables

`hint_purchase` (timestamped purchase, level, cost — billing becomes
auditable), `item_use` (who sabotaged whom, with what, when), `flag_report`
(report + model verdict — replaces `complaints.jsonl`).

**Done when**: each table inserts and reads back in an integration test, and
a participant's sequence of hint purchases can be reconstructed sorted by
timestamp.

### 2.5 — `llm_call` and cost queries

Model, call type, input/output tokens, failure. The queries that replace
`usage.py`: cost per actually generated game (`per_generated_game`, not
diluted by the cache) and `cache_hit_rate`. A failed generation is recorded
as a failure, never counted as a generated game (§3.4).

**Done when**: on a test dataset, the cost-per-game query returns the
expected aggregate, and a failed call does not enter `per_generated_game`.

### 2.6 — Development seed

A seed script: a few accounts, a room, a finished game with positions,
answers, hint purchases and LLM calls — enough to develop the next phases
without clicking.

**Done when**: the seed fills a fresh database without error, replays
without error (idempotent), and the queries of 2.3 to 2.5 return non-empty
results on it.

## Exit gate

- `drizzle-kit migrate` passes on a fresh database, in CI, not only on an
  already-migrated local one.
- All exported queries are typed; no free-form SQL outside the package.
- The cost of a game is a query that answers correctly on the seed.
- `pnpm build && pnpm test && pnpm lint && pnpm typecheck` pass.

## Contract touched

See `01-contract-to-preserve.md`: the **server authority** — `game_position`
carries the solution and appears in no read before the end of the game
(§3.1); the **accounting** (§3.4) — `cache_hit_rate` and
`per_generated_game` stay exposed, a failed generation is not counted; the
**billing of hints** becomes auditable after the fact (`hint_purchase`),
which locks monotonicity by something other than in-memory state alone.

## Pitfalls

- **No business logic in the database.** `participant` stores the breakdown
  computed by `domain`, it does not recompute it; no trigger, no stored
  procedure.
- A merged migration is never edited again: add a new one. Regenerating the
  initial migration "because nothing is deployed" breaks the other
  machines' databases.
- The convenient join that embeds `game_position` in a game state "for
  later" is exactly the leak that §3.1 forbids: negative assertion on the
  serialisation of in-progress reads.
- The article snapshot in `game` is a snapshot: do not re-normalise it,
  normalisation belongs to phase 3.
- Neon in CI: take a fresh database (Neon branch or local Postgres) on every
  run, otherwise the migrations are never really tested.
