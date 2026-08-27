# Phase 10 — the dismantling steps

> Definitions of steps 10.9 to 10.12: deleting the Python, rigging the
> rollback, cutting production over, and rewriting the current state. The step
> states live in `phase-10-cutover.md`.
>
> None of these starts before the grid of `phase-10-contract-map.md` is
> complete. That is the entry condition of the phase, not a preference.

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

The procedure is written: **`phase-10-rollback.md`**. It also states, in black
and white, what a rollback costs — accounts and history created after the
cutover stay in Neon and become *inaccessible*, not lost; rooms in flight die
in both directions; the article cache starts cold.

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

