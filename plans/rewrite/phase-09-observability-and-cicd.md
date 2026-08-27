# Phase 9 — Observability and CI/CD

| | |
|---|---|
| **State** | **in progress** — 9.1 done, 9.5 done (brought forward) |
| **Branch** | `feat/rewrite-phase-9` |
| **Depends on** | phases 4, 5 and 8 |
| **Delivers** | a complete CI/CD and a system that lets itself be observed |

## Objective

Make the system observable — `/api/health` contract preserved field by
field, usage dashboard backed by the `llm_call` table, structured logging,
Sentry — and build the target CI/CD chain: GitHub Actions (lint, typecheck,
tests, build, Playwright e2e), web on Vercel with per-PR previews, realtime
on Fly.io, `deploy-check` probe ported, documentation lock reimplemented.

## Why now

Phases 4, 5 and 8 deliver the API, the accounts and a frontend playable end
to end — everything this phase deploys, probes and tests. And phase 10 is
impossible without it: you do not delete the Python without a green CI on
the new stack nor a probe that says what production serves. Two current
guarantees die silently if they are not ported explicitly: the deployment
verification loop (`deploy-check.yml`) and the documentation lock
(`test_architecture_doc.py`).

## Steps

### 9.1 — `/api/health` contract preserved field by field

✅ **Done** — `VERCEL_GIT_COMMIT_SHA` added as the primary commit source on the
web side (Render-style variables remain for backward compatibility); Vitest
equivalents of all five Python tests committed, including the ping literal and
the key-never-appears assertion by value.

`GET /ping` answers exactly `{"status": "alive"}`. `GET /api/health`
exposes `status`, `version`, `commit` (string present even when empty
locally), `commit_short` (7 characters), `model`, `llm_configured`
(boolean) — and never the API key. The commit comes from
`VERCEL_GIT_COMMIT_SHA` on the web side and from a variable injected at
deployment on the Fly side, like `RENDER_GIT_COMMIT` today.

**Done when**: the five tests of `backend/tests/test_health.py` have their
Vitest equivalent, including "the key never appears in the serialised
JSON".

### 9.2 — Usage dashboard on `llm_call`

`/api/usage` reads the `llm_call` table instead of in-memory counters:
input/output tokens per call type, failures counted separately,
`cache_hit_rate` and `per_generated_game` (cost per actually generated
game, not diluted by the cache) still exposed.

**Done when**: the tests of `test_usage.py` have their equivalent, and a
service restart no longer resets the counters — that was the table's whole
reason for existing.

### 9.3 — Structured logging and Sentry

JSON logs (level, timestamp, request or room identifier) on `web` and
`realtime`; `scripts/checks.sh` already forbids `console.log`. Sentry on
both services, DSN through an environment variable, release tagged with the
commit.

**Done when**: an error triggered on purpose on a preview appears in Sentry
with the right commit, for each of the two services.

### 9.4 — Rewrite `ci.yml` for the monorepo

`lint`, `typecheck`, `test`, `build` jobs through pnpm and the Turborepo
cache. Two things are kept: the `guard` job — its push/PR deduplication is
what guarantees that a phase PR towards the umbrella keeps its checks — and
the pytest job, as long as `backend/` exists. It only leaves at phase 10.

**Done when**: CI passes with the new jobs and the old Python job, and a
push without an open PR still triggers a run.

### 9.5 — Playwright e2e in CI

The journey from §6 of the plan: two browsers in the same room, and the
negative assertions — no sabotaged paragraph nor explanation in the DOM
during the round, CC BY-SA attribution visible during and after. No real
LLM call: article served from a fixture, fake key as today.

**This step owns the harness**, and it is the only one that does. 7.8 asked
for a Playwright run of the solo journey and was cut back to jsdom for that
reason: the browser, its CI job and the fixture-served article are set up
once, here. The solo journey is one of the runs it should carry.

✅ **Done, out of order** — brought forward from this phase to unblock step
8.9, which cannot be written without it. Three notes:

- Written on the **current** `ci.yml`, not on the one 9.4 will produce. The
  job is deliberately dull, and everything that decides anything lives in
  `apps/e2e/playwright.config.ts`, so 9.4 moves a block rather than
  rewriting a harness.
- **No seam in the application.** `WIKIPEDIA_API_URL` and `MODEL_BASE_URL`
  are two optional environment variables, absent in every deployment, and
  the run points both applications at a stub answering from
  `@wikifake/article/testing`. What differs between a browser run and a real
  one is configuration.
- **Two contexts, not four browsers** — the pitfall list below asks for a
  short journey, and two isolated contexts are two players as far as the
  server is concerned. 8.9 adds the four-player round with items on top.

It found a defect on its first run: the socket never opened after "Open a
room". See `plans/current-state/05-known-debt.md`.

**Done when**: the e2e job passes in CI, and fails if a field of the
solution is deliberately leaked into the start payload.

### 9.6 — Documentation lock, Zod version

The protocol documentation (inbound and outbound WS messages, REST routes,
error codes) is generated from the schemas of `packages/protocol` by a pnpm
script; a test compares the generated file to the committed file. This is
the reimplementation of `test_architecture_doc.py`: without it, the
guarantee "the docs do not drift from the code" disappears silently. The
Python test itself now runs on `plans/current-state/*.md` and must keep
passing until phase 10.

**Done when**: adding a message to the schema without regenerating the doc
makes `pnpm test` fail.

### 9.7 — Deploy the web on Vercel

Vercel project wired to the repository, per-PR previews, environment
variables set. The public production stays served by Render until phase 10:
Vercel does not receive the domain yet.

**Done when**: every PR gets a preview URL whose `/api/health` returns the
PR's commit.

### 9.8 — Deploy the realtime on Fly.io

`fly.toml` in `apps/realtime`, deployed from CI, health check exposing the
served commit, Redis URL and allowed WebSocket origins through environment
variables.

**Done when**: a multiplayer game plays from a Vercel preview against the
deployed Fly instance.

### 9.9 — Port the `deploy-check` probe

After a push to `main`, the workflow polls the health probe and compares
`commit` to the pushed SHA until the deadline expires. Two services now:
web and realtime, each with its own URL. Behaviour preserved: clean skip if
the URL variable is not defined, `workflow_dispatch` with an adjustable
deadline. `DEPLOY_URL` keeps pointing at Render until the cutover.

**Done when**: launched by hand against a preview, the workflow succeeds on
the right SHA and fails on a different one.

### 9.10 — Update the ruleset's required checks

The rulesets of `main` and `staging` require a green CI by job name. The
names change: without a ruleset update, every PR blocks on a "pending"
check that will never arrive. Note that the current GitHub check contexts
are still named in French (`Conformité de la PR`, `Revue humaine`,
`Analyse de secrets`, `Ce run est-il utile ?`, `Aucun push direct sur main
ni staging`): renaming them to English requires updating the ruleset's
required checks in the same move — otherwise every pull request blocks
forever on a check that never reports.

**Done when**: a test PR towards `staging` goes green without a ghost
check, and the new names appear in the required checks list.

## Exit gate

- Green CI: lint, typecheck, tests, build, e2e — plus the Python job, still
  alive until phase 10.
- Per-PR Vercel preview; Fly service deployed and reachable.
- `deploy-check` probe working against both services.
- Documentation lock active: generated doc = committed doc, checked in CI.
- The cost of a game is readable in the database and survives a restart.

## Contract touched

The "Deployment identity" and "The documentation ↔ code lock" sections of
`01-contract-to-preserve.md`, in full. Plus, in "Cache and accounting", the
exposure of `cache_hit_rate` and `per_generated_game`.

## Pitfalls

- **The `guard` job is not decorative.** Removing it "to simplify" leaves
  phase PRs towards the umbrella without any check — a `fix(ci)` patch has
  already been paid to learn that.
- **The ruleset is updated at the same time as the job names**, not after:
  in between, every PR in the repository is blocked.
- The old stack's jobs leave with the code they test, not before: removing
  the pytest job here would let phase 10 run without a net.
- Vercel preview protection can answer 401 to the probe and the e2e: plan a
  bypass token or probe without protection.
- No real LLM in CI: slow, costly, non-deterministic. The current fake key
  is a principle to keep, not a stopgap.
- Sentry DSN and Fly/Vercel tokens go into GitHub secrets, never into the
  repository — `checks.sh` catches some of them, not all.
