# Phase 9 — Observability and CI/CD

| | |
|---|---|
| **State** | **in progress** — 9.7 deployed and verified live; 9.8 and 9.10 need a human |
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
impossible without it: you do not delete the Python without a green CI on the
new stack nor a probe that says what production serves. Two guarantees die
silently if not ported explicitly: the deployment verification loop
(`deploy-check.yml`) and the documentation lock (`test_architecture_doc.py`).

## Steps

### 9.1 — `/api/health` contract preserved field by field

✅ **Done** — `VERCEL_GIT_COMMIT_SHA` added as the primary commit source on the
web side (Render-style variables remain for backward compatibility); Vitest
equivalents of all five Python tests committed, including the ping literal and
the key-never-appears assertion by value.

**Done when**: the five tests of `backend/tests/test_health.py` have their
Vitest equivalent, including "the key never appears in the serialised
JSON".

### 9.2 — Usage dashboard on `llm_call`

✅ **Done** — `handleUsage` reads `readUsageTotals` and `readUsageByKind` from
the `llm_call` table; five Vitest equivalents of `test_usage.py`, including the
route shape (`usage` and `cache` keys, `ttlSeconds` present when the cache is
reachable, `null` when not) and the division-by-zero guard.

**Done when**: the tests of `test_usage.py` have their equivalent, and a
service restart no longer resets the counters — that was the table's whole
reason for existing.

### 9.3 — Structured logging and Sentry

✅ **Done (code)** — `pino` in both apps; `initSentry` wired into
`apps/web/instrumentation.ts` (the Next.js startup hook) and
`apps/realtime/src/main.ts`. `SENTRY_DSN` optional in the env schema, release
tagged with the deployed commit. Six Vitest tests: JSON structure and level
filter, DSN gate and release. The live verification waits on 9.7/9.8.

**Done when**: an error triggered on purpose on a preview appears in Sentry
with the right commit, for each of the two services.

### 9.4 — Rewrite `ci.yml` for the monorepo

✅ **Done** — four parallel jobs (`lint`, `typecheck`, `test`, `build`) with a
pnpm store and a Turborepo cache each; `guard` kept and renamed; the two legacy
jobs kept. All use `--ignore-scripts`, `@sentry/cli` being the reason.

The `guard` job stays: its push/PR deduplication is what guarantees that a
phase PR towards the umbrella keeps its checks. So does the pytest job, as
long as `backend/` exists — it only leaves at phase 10.

**Done when**: CI passes with the new jobs and the old Python job, and a
push without an open PR still triggers a run.

### 9.5 — Playwright e2e in CI

**This step owns the harness**, and it is the only one that does. 7.8 asked
for a Playwright run of the solo journey and was cut back to jsdom for that
reason: the browser, its CI job and the fixture-served article are set up
once, here.

✅ **Done, out of order** — brought forward to unblock step 8.9, which cannot
be written without it. Three notes:

- Written on the **current** `ci.yml`, not on the one 9.4 produced. Everything
  that decides anything lives in `apps/e2e/playwright.config.ts`, so 9.4 moved
  a block rather than rewriting a harness.
- **No seam in the application.** `WIKIPEDIA_API_URL` and `MODEL_BASE_URL` are
  optional variables, absent in every deployment, and the run points both apps
  at a stub answering from `@wikifake/article/testing`. What differs between a
  browser run and a real one is configuration.
- **Two contexts, not four browsers** — two isolated contexts are two players
  as far as the server is concerned. 8.9 adds the four-player round on top.

It found a defect on its first run: the socket never opened after "Open a
room". See `plans/current-state/05-known-debt.md`.

**Done when**: the e2e job passes in CI, and fails if a field of the
solution is deliberately leaked into the start payload.

### 9.6 — Documentation lock, Zod version

✅ **Done** — `packages/protocol/src/docs/` already generates four Markdown
pages from the live Zod schemas and compares them to committed snapshots in
`plans/protocol/` via `toMatchFileSnapshot`. All 221 protocol tests pass.
Regenerate with `pnpm --filter @wikifake/protocol docs`.

This is the reimplementation of `test_architecture_doc.py`: without it, the
guarantee "the docs do not drift from the code" disappears silently. The
Python test itself now runs on `plans/current-state/*.md` and must keep
passing until phase 10.

**Done when**: adding a message to the schema without regenerating the doc
makes `pnpm test` fail.

### 9.7 — Deploy the web on Vercel

✅ **Done (repository side)** — `vercel.json` at the root builds through
Turborepo, because six workspace packages are what a bare `next build` cannot
resolve. Project settings, environment variables and the preview-protection
bypass are in `phase-09-deployment-setup.md`. The dashboard half is manual.

The public production stays served by Render until phase 10: Vercel does not
receive the domain yet.

**Done when**: every PR gets a preview URL whose `/api/health` returns the
PR's commit.

### 9.8 — Deploy the realtime on Fly.io

✅ **Done (repository side)** — `fly.toml` and a `Dockerfile` in
`apps/realtime`, a `deploy-realtime.yml` workflow that skips cleanly without
`FLY_API_TOKEN`, and `/api/health` on the Hono app answering the same six-field
shape the web app answers. `FLY_GIT_COMMIT` is a build argument: Fly injects no
commit variable of its own, so an image that did not bake one would answer an
empty string and the probe would wait for a match that cannot come.

**Done when**: a multiplayer game plays from a Vercel preview against the
deployed Fly instance.

### 9.9 — Port the `deploy-check` probe

✅ **Done** — the polling loop moved to `scripts/probe-deploy.sh`, run once
per target through a matrix: Render, the web app, the realtime service, each
skipping cleanly when its variable is unset. Two additions the split made
necessary: a `x-vercel-protection-bypass` header, because Vercel's protection
answers 401 and a 401 is indistinguishable from a service that is not up; and
`url` / `expected_sha` dispatch inputs, which is how the step is verified by
hand. Exercised against a stub: exit 0 on the right SHA, exit 1 on a different
one and on no response. `DEPLOY_URL` keeps pointing at Render until cutover.

**Done when**: launched by hand against a preview, the workflow succeeds on
the right SHA and fails on a different one.

### 9.10 — Update the ruleset's required checks

⚠️ **Half done — the other half is an administrator's.** The four remaining
French job names are renamed in `rules.yml`. Updating the ruleset is a gesture
in the GitHub UI, and no workflow here has a token that can do it.

The ordering is not obvious: a PR carrying the rename reports the new names
while the ruleset still waits for the old ones, so it cannot merge through its
own gate. The three steps, the two contexts dropped rather than renamed, and
why the alternatives are worse are in `phase-09-ruleset-rename.md`. **Read it
before merging the phase-9 umbrella.**

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
  in between, every PR in the repository is blocked. See
  `phase-09-ruleset-rename.md` before merging the umbrella.
- The old stack's jobs leave with the code they test, not before: removing
  the pytest job here would let phase 10 run without a net.
- Vercel preview protection can answer 401 to the probe and the e2e: plan a
  bypass token or probe without protection.
- No real LLM in CI: slow, costly, non-deterministic. The current fake key
  is a principle to keep, not a stopgap.
- Sentry DSN and Fly/Vercel tokens go into GitHub secrets, never into the
  repository — `checks.sh` catches some of them, not all.
