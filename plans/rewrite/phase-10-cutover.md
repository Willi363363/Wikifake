# Phase 10 — Cutover

| | |
|---|---|
| **State** | **in progress** — production runs the new stack, multiplayer included; 10.10's dry run and the domain are left |
| **Branch** | `feat/rewrite-phase-10-contract` |
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

The check-off is read as one grid: `phase-10-contract-map.md`, one row per
guarantee, a file and a case in each cell. The steps below are its sections,
and a step is done when its own rows are filled.

| # | Step — checking the contract off | State |
|---|---|---|
| 10.0 | Port the compliance surface no phase owned | ✅ done |
| 10.1 | Check off "Server authority" (C1) | ✅ done |
| 10.2 | Check off "The scoring scale" (C2) | ✅ done |
| 10.3 | Check off "Article generation" (C3) | ✅ done |
| 10.4 | Check off "Cache and accounting" (C4) | ✅ done |
| 10.5 | Check off "Transport robustness" (C5) | ✅ done |
| 10.6 | Check off "Compliance and indexing" (C6) | ✅ done |
| 10.7 | Check off "Deployment identity" (C7) | ✅ done |
| 10.8 | Check off "The documentation ↔ code lock" (C8) | ✅ done |

Definitions: `phase-10-steps-checkoff.md`.

**10.0 was the one thing the grid found**, and it was not a phase's fault: the
compliance surface of the old `frontend/public/` — `robots.txt`, the sitemap,
Open Graph, the canonical, and the front door as a page rather than a
redirect — was never given to a step by any phase file. A hole in a branch
goes back to its branch; a hole in the plan is filled where it is found.

C7.3 turned out to be broken and not merely untested: `/` redirected to
`/play`, so the front door answered 307 and no document at all. That is the
argument for the grid, in one line.

**The entry condition of this phase is now met.** Every line of the contract
points at a named test, and every one of those tests runs — nothing is skipped
when Postgres and Redis are present, which is how CI runs them.

| # | Step — dismantling and cutting over | State |
|---|---|---|
| 10.9 | Delete the Python | ✅ done |
| 10.10 | Rig the rollback net | ⚠️ written — the dry run needs a human |
| 10.11 | Merge and cut production over | ✅ done |
| 10.12 | Rewrite the current state | ✅ done |

Definitions: `phase-10-steps-cutover.md`.

**10.9 was not only a deletion.** Six tests in the new stack read the old one
to prove they agreed with it, and five of them were redundant the moment their
subject went — the scale, the item identifiers and the token transcription are
each asserted against the contract directly. The sixth was C8.1, and it was
rebuilt rather than dropped: `apps/web/src/route-parity.test.ts` and
`apps/realtime/src/catalogue-parity.test.ts` hold the same line against the
routes and the messages of `apps/`. The inbound half stopped needing a test at
all, which is the rewrite's own argument in miniature — the schema *is* the
dispatch table, so the drift a test looked for cannot happen.

**10.11 is done, and production is the proof.** `staging` reached `main` as
`35e0a33`, and `/api/health` on the deployed web app answers that exact SHA —
the mechanism C7.2 and `deploy-check` both rest on. A real round was generated
against the live deployment: 100 paragraphs, 4 falsifications, and no
explanation, hint or position anywhere in the payload. Eleven contract
guarantees were re-verified against production rather than against a test
runner, C3.1 among them.

What 10.11 did **not** finish was two of the runbook's own steps, and it did
step 7 without them. One has since been caught up:

- **Step 5 — the domain.** Still outstanding. Render holds it, suspended, so the
  public address answers nothing; `wikifake.vercel.app` does. Flagged since 10.9.
- **Step 6 — the probe variables.** ✅ Done 2026-08-30. `WEB_DEPLOY_URL` was
  never set, so the probe for the application users actually reach skipped while
  reporting success; `DEPLOY_URL` was never deleted, so the probe for the
  suspended Python service failed on every push to `main` — the red on #143,
  #145, #152 and #155. Both were fixed and the probe run by hand to prove it.
  Phase 9's exit gate passed with it.

`phase-10-cutover-runbook.md` owns the domain, and records which of its steps ran.

**10.10 is written and not run**, and it is cheaper now than when it was
written. The procedure is `phase-10-rollback.md` — one page, read before 10.11
rather than during. Its one uncertain claim is whether a suspended Render
service comes back with the same image. Confirming that used to mean suspending
**live production**; it no longer does, because that service holds no traffic —
so the dry run is a resume, a reading of `/api/health`, and a suspend. What it
mainly buys is the pre-cutover commit value, which runbook step 1 was supposed
to capture and nobody wrote down. The step stays open until it has happened and
the sheet says so.

**10.12 is done, and it changed the shape of `plans/current-state/`.** Three
files went — the FastAPI modules, the Vite directories, the hand-written
WebSocket protocol — and three took their place: `01-packages.md`, `02-web.md`,
`03-realtime.md`. The protocol is no longer described there at all, because
`plans/protocol/` is generated from the schemas and a second description is the
one that drifts. The debt register lost fourteen entries it no longer had any
business holding and gained three the new stack actually has.

## Exit gate

**Not passed.** Two lines of it are outstanding, and both need a human.

- ✅ The grid of `01-contract-to-preserve.md` is checked off in full: every
  line points to a named test that passes in CI.
- ✅ Not one Python file left in the repository; pnpm has replaced `make`.
- ✅ Public production is served by Vercel and the socket host, `deploy-check`
  green. The socket service went live on Render's free tier and a four-player
  round was played against it — `phase-09-realtime-live.md`.
- ⚠️ The rollback is written and has been dry-run — **written, never run.** The
  criterion asks for both; only the first is true. Step 10.10, and its dry run
  no longer touches production, so what is left of it is three dashboard
  gestures.
- ✅ The current state describes the real stack.

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
