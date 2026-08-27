# Session handover — 2026-08-27

> Written in English, like everything else in this repository (`CLAUDE.md`).

## Context

The WikiFake rewrite: a Python/FastAPI + React app becoming a TypeScript
monorepo, phase by phase, one step per branch and per pull request. This
session implemented **phase 9 — observability and CI/CD**, steps 9.4 and 9.6
through 9.10.

## State at the pause

- **Main task:** phase 9 — observability and CI/CD
- **Progress:** code complete. Steps 9.1–9.9 done; 9.10 done in the repository,
  pending an administrator's gesture in the GitHub UI.
- **Last file modified:** `apps/web/src/game/usage.test.ts`
- **Last commit:** `81c7757` — fix(lint): clear two errors left by steps 9.2 and
  9.3, and reformat
- **Branch:** `feat/rewrite-phase-9-ruleset` (top of the stack, pushed)

## What works ✅

- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` and `pnpm test` are all
  green across the ten packages.
- Six stacked pull requests, each one step, each targeting the previous:

  | PR | Step | Content |
  |---|---|---|
  | #103 | 9.4 | CI split into parallel `lint` / `typecheck` / `test` / `build` |
  | #104 | 9.6 | Documentation lock — verified, already implemented |
  | #105 | 9.7 | `vercel.json` building through Turborepo |
  | #106 | 9.8 | `fly.toml`, `Dockerfile`, `/api/health`, deploy workflow |
  | #107 | 9.9 | `deploy-check` ported to three targets |
  | #108 | 9.10 | Four check contexts renamed + the ruleset runbook |

- `scripts/probe-deploy.sh` exercised against a local stub: exit 0 on the right
  SHA, exit 1 on a different one, exit 1 with different advice when nothing
  answers.

## In progress ⚙️

Nothing is half-written in code. The working tree is clean and every branch is
pushed. What remains is not code.

## Blocked — needs a human ❌

1. **The ruleset update (step 9.10).** A ruleset requires its checks *by context
   name*; a required context that never reports does not fail, it stays pending
   and blocks every pull request in the repository. A PR carrying the rename
   reports the new names while the ruleset still waits for the old ones, so it
   cannot merge through its own gate. No ruleset API was available in this
   session, and no workflow here should hold a token that can edit one.
   → **Read `plans/rewrite/phase-09-ruleset-rename.md` before merging the
   phase-9 umbrella.**

2. **Vercel and Fly provisioning (steps 9.7, 9.8).** Creating the projects and
   setting their environment variables and secrets is dashboard work. The
   variables each one needs are listed in
   `plans/rewrite/phase-09-deployment-setup.md`.

3. **The live Sentry verification (step 9.3).** "An error on a preview appears
   in Sentry with the right commit" cannot be checked until 1 and 2 are done.

## Next steps, in order

1. Review and merge the stack, bottom first: #103 → #104 → #105 → #106 → #107
   → #108. Each targets the one before it.
2. Provision Vercel and Fly per `phase-09-deployment-setup.md`; set
   `WEB_DEPLOY_URL` and `REALTIME_DEPLOY_URL` so the probe stops skipping.
3. Perform the three-step ruleset dance from `phase-09-ruleset-rename.md`, then
   open a throwaway PR towards `staging` to confirm nothing hangs pending.
4. Verify 9.3 and 9.7 live: an error on a preview reaching Sentry with the right
   commit, and a preview's `/api/health` returning the PR's commit.
5. Start phase 10 — the Python cutover.

## Commands to resume

```bash
nvm use                                    # Node 22, pinned by .nvmrc
pnpm install                               # monorepo dependencies

pnpm test                                  # monorepo tests
pnpm typecheck && pnpm lint                # what CI runs
bash scripts/checks.sh diff origin/staging # before asking for a merge

# The deploy probe, by hand against a stub or a preview
scripts/probe-deploy.sh <url> <sha> <timeout-seconds> <label>
```

Read first, in this order:

```
plans/README.md                                  # where the project stands
plans/rewrite/phase-09-observability-and-cicd.md # this phase, step by step
plans/rewrite/phase-09-ruleset-rename.md         # the blocking one
plans/rewrite/phase-09-deployment-setup.md       # Vercel and Fly
```

## Technical notes

- **`FLY_GIT_COMMIT` is a build argument, not a platform variable.** Fly injects
  no commit of its own, unlike Vercel's `VERCEL_GIT_COMMIT_SHA` and Render's
  `RENDER_GIT_COMMIT`. The deploy workflow bakes it into the image; an image
  that baked none would answer an empty string and the probe would wait for a
  match that cannot come.
- **`--ignore-scripts` everywhere** — CI, Vercel and the Dockerfile. `@sentry/cli`
  downloads a binary at install time and nothing in either build needs it.
  `pnpm-workspace.yaml`'s `allowBuilds` holds the exception for the day a
  sourcemap upload does.
- **The realtime health check is `/ping`, not `/api/health`.** The platform asks
  whether the process answers; a probe that reads the database would report the
  service down when only the database is. `/api/health` is for the CI probe.
- **`auto_stop_machines = false` on Fly.** A stopped machine drops every socket
  it was holding, and the players on them do not come back because a health
  check woke it up.
- **Two contexts are dropped from the required checks rather than renamed:** the
  deploy probe (it runs after a merge, so requiring it on a PR requires a check
  that cannot report) and the direct-push detector (`push`-only; the ruleset
  itself is the prevention).
- **The `guard` job is not decorative.** Its push/PR deduplication is what keeps
  a phase PR towards the umbrella from losing all its checks. A `fix(ci)` patch
  was already paid to learn that.
- **The phase sheet sits at exactly 200 lines**, the repository's documentation
  limit. Adding to it means trimming it, or splitting it further.

---
*Generated by the `ff` skill — Claude Code session*
