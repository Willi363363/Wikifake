# Phase 10 — Cutover

| | |
|---|---|
| **State** | to do |
| **Branch** | `feat/rewrite-phase-10` |
| **Depends on** | all the others (0 to 9) |
| **Delivers** | a repository without Python, production on the new stack |

## Objective

Delete the Python and cut production over. Single, non-negotiable entry
condition: **every line of `01-contract-to-preserve.md` must have an
equivalent test in the new stack**. Steps 10.1 to 10.8 are that
verification, section by section; nothing else starts before.

## Why now

Last, by construction: every contract invariant cost a production bug, and
deleting the Python also deletes its tests — any line without an equivalent
would lose its guarantee silently. The Python stays as long as a single
line is not covered, and that is not negotiated in advance. If the previous
phases did their job, only verification and dismantling remain here.

## Steps

For 10.1 to 10.8, the completion rule is shared: **every bullet of the
section points to a named test (file and case) in the new stack, the
mapping is recorded in the PR description, and those tests pass in CI**. A
hole discovered here is not filled here: we go back to the phase concerned,
on its branch.

### 10.1 — Check off "Server authority"

Start payload without the solution — verified by keys **and by values** —,
server-side score and client penalties ignored, monotonic hints billed
once, `HINT_LOCK`, score theft and SCANNER applied server-side, host role
verified server-side, promotion and room end.

**Done when**: the shared rule is met for the section.

### 10.2 — Check off "The scoring scale"

The formula, the constants, the non-cumulative hint cost, the possible
negative score, no bonus past the deadline, and the reference case
`tp=3, fp=1, penalty=20, stolen=50, 200 s left out of 300 → 400`.

**Done when**: the shared rule is met for the section.

### 10.3 — Check off "Article generation"

`positions` designates the actually modified paragraphs, strict index
parity, base-1 indexes, deduplication, whitespace normalisation, stateless
generator, clean failure when the Wikipedia page is not found.

**Done when**: the shared rule is met, backed by real HTML fixtures.

### 10.4 — Check off "Cache and accounting"

Normalised keys, copies on the way in and on the way out, 6 h TTL, 3
variants, LRU 200, variant rotation, failure neither cached nor counted,
`cache_hit_rate` and `per_generated_game` exposed.

**Done when**: the shared rule is met for the section.

### 10.5 — Check off "Transport robustness"

Nickname validated and rejections typed, homonym refused, `bad_json`
without closing the connection, bounded chat, bounded and rate-limited
cursors, unique room codes and 503 ceiling, frames beyond 64,000
characters → close 1009.

**Done when**: the shared rule is met, protocol and e2e tests together.

### 10.6 — Check off "Compliance and indexing"

CC BY-SA attribution during and after the round, `robots.txt` excluding
training crawlers, `<html lang="fr">`, bounded meta tags, Open Graph,
canonical, sitemap.

**Done when**: the shared rule is met for the section.

### 10.7 — Check off "Deployment identity"

Exact `/ping`, `/api/health` field by field, API key never exposed, `GET /`
as HTML 200 with a non-empty `<title>`.

**Done when**: the shared rule is met — phase 9 already had to meet it,
this step records the fact, without rewriting anything.

### 10.8 — Check off "The documentation ↔ code lock"

The generated-versus-committed test from phase 9 runs in CI and covers what
`test_architecture_doc.py` covered: inbound messages, outbound messages,
routes.

**Done when**: deliberately breaking the generated doc makes CI fail.

### 10.9 — Delete the Python

`backend/`, `main.py`, `pytest.ini`, `requirements.txt`, `Dockerfile`,
`render.yaml` — and the Vite `frontend/` if it still lives. The pytest and
npm CI jobs leave with the code they tested. The `Makefile` targets are
rewritten as pnpm scripts, then the `Makefile` disappears; `.githooks/` and
`plans/method/`, which cite `make check` and `make hooks`, follow.

**Done when**: a fresh clone follows the `README` and gets a working
environment without Python installed, and
`pnpm build && pnpm test && pnpm lint && pnpm typecheck` pass.

### 10.10 — Rig the rollback net

At cutover time, the Render service will not be deleted but **suspended**,
its last image intact. The rollback procedure fits on one page: wake Render
up, repoint the domain, restore `DEPLOY_URL`; the Python code comes back by
`git revert` of the merge if a fix is needed. To be written in black and
white: accounts and history created after the cutover stay in Neon but
become inaccessible for the duration of the rollback.

**Done when**: a dry run (suspend then wake, outside playing hours) has
succeeded — Render's `/api/health` answers with the old commit — and the
procedure is written.

### 10.11 — Merge and cut production over

Turn off Render's `autoDeploy` before the merge (otherwise it triggers a
build on a vanished `Dockerfile`). PR `feat/refonte` → `staging` then
`staging` → `main`, per `01-git-flow.md`. Then the cutover: domain to
Vercel, client to the Fly WebSocket URL, probe URL variables updated,
Render suspended (see 10.10).

**Done when**: `deploy-check` is green on `main` against the new
production — the commit served by both services equals the merged SHA — and
a multiplayer game plays on the public domain.

### 10.12 — Rewrite the current state

`plans/current-state/` now describes the real stack: the target
architecture become the status quo, the remaining debt, and
`01-contract-to-preserve.md`, which does not disappear — it remains the
list of invariants, each backed by its TypeScript tests.
`plans/current-state/` then describes the new stack, no longer the old one.

**Done when**: a reader who has never seen the project understands the
architecture from `plans/current-state/` without meeting a single mention
of FastAPI, and the 200-line check passes.

## Exit gate

- The grid of `01-contract-to-preserve.md` is checked off in full: every
  line points to a named test that passes in CI.
- Not one Python file left in the repository; pnpm has replaced `make`.
- Public production is served by Vercel and Fly, `deploy-check` green.
- The rollback is written and has been dry-run.
- The current state describes the real stack.

## Contract touched

All of it. This phase **is** the verification of the entire contract: that
is its entry condition, not a side note.

## Pitfalls

- **Checking off from memory.** "It is covered somewhere" is not a checked
  box: every line demands a file and a test name.
- **Deleting the Render service instead of suspending it**: the rollback
  net disappears at the precise moment it might be needed.
- Render's `autoDeploy` on `main`: merging without having turned it off
  triggers a build doomed to fail on the still-active production.
- `make check` is called by `.githooks/` and cited in `plans/method/`:
  rewriting the targets without updating hooks and docs breaks every
  commit.
- The probe URL variables: forgotten, `deploy-check` fails on every push
  against a sleeping Render, and that noise masks real problems.
- A hole in the grid turns the phase into a construction site: it is
  filled in its original phase, not here.
