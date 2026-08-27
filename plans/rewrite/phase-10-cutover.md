# Phase 10 — Cutover

| | |
|---|---|
| **State** | **in progress** — the grid is complete; the dismantling has not started |
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
| 10.9 | Delete the Python | to do |
| 10.10 | Rig the rollback net | to do |
| 10.11 | Merge and cut production over | to do |
| 10.12 | Rewrite the current state | to do |

Definitions: `phase-10-steps-cutover.md`.

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
