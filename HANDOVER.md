# Session handover — 2026-08-27

> Written in English, like everything else in this repository (`CLAUDE.md`).
>
> This file replaces the phase-9 handover of the same day. That one said the
> next step was merging pull requests #103 to #108; the stack now runs to #111
> and phase 10 is all but finished, so it had stopped being a handover and
> started being a wrong answer.

## Context

The WikiFake rewrite: a Python/FastAPI + React app becoming a TypeScript
monorepo, phase by phase, one step per branch and per pull request. This
session finished **phase 9** and took **phase 10** as far as code can take it.

## State at the pause

- **Main task:** phase 10 — the cutover.
- **Progress:** twelve of thirteen steps done. Only 10.11 is left, and not one
  line of it is code.
- **Branch:** `feat/rewrite-phase-10-ruleset`, top of the stack.
- **Working tree:** clean, everything pushed.

Progress lives in `plans/README.md` and the step table in
`plans/rewrite/phase-10-cutover.md`. Those two, and nowhere else.

## What works ✅

`pnpm typecheck`, `pnpm lint`, `pnpm format:check` and `pnpm build` are green.
**1,884 unit and integration cases and 11 browser journeys pass with nothing
skipped** — which requires Postgres and Redis up, and is the only kind of run a
claim about the contract can be made from. See
`plans/current-state/05-known-debt.md` on why a green run without them is not
the same thing.

The entry condition of phase 10 is met: every guarantee of the contract points
at a named test in `plans/rewrite/phase-10-contract-map.md`. Checking it found
one broken clause — C7.3, where `/` answered 307 and no document — and one hole
no phase owned, the `robots.txt` / sitemap / Open Graph surface. Both closed.

The Python and the Vite frontend are gone: 16,605 lines, and the `Makefile`
with them.

## Blocked — needs a human ❌

**Step 10.11, in full.** Seven gestures across dashboards, DNS and repository
settings. The order matters more than any one of them, so it is a checklist:

> **`plans/rewrite/phase-10-cutover-runbook.md`** — read it before starting.

Three of them carry a hazard worth naming here too:

1. **Render's `autoDeploy` goes off first.** The merge deletes the `Dockerfile`
   it builds from, so an automatic deploy would fail on live production.
2. **The ruleset's required-checks list is emptied before the merge and refilled
   after, with nine names and not eleven.** The merge renames four check
   contexts and deletes two, and a required context that never reports does not
   fail — it stays pending, blocking every pull request in the repository.
   `plans/rewrite/phase-09-ruleset-rename.md` has the ordering and why there is
   only one window.
3. **Render is suspended, never deleted.** Its image is the rollback net.

**Step 10.10's dry run.** The procedure is written
(`plans/rewrite/phase-10-rollback.md`); its one uncertain claim — that a
suspended Render service comes back with the same image — can only be confirmed
by suspending live production, outside playing hours.

**The live Sentry check (9.3) and the preview `/api/health` check (9.7)** wait
on the provisioning of `plans/rewrite/phase-09-deployment-setup.md`.

## The thing that is not a step, and is the real blocker

**Nothing of phases 1 to 10 has merged.** `feat/rewrite-phase-1` descends from
the umbrella `willi363/refonte`, which holds phase 0 and nothing else. The whole
rewrite is one linear stack of open pull requests from #33 upwards, each
targeting the one before it — `gh pr list --state open` in ascending order is
the merge sequence.

That is a decision, not a defect — but it is the decision the project is
waiting on, and it is why the ruleset dance is one window rather than one per
phase.

## Next steps, in order

1. Read `plans/rewrite/phase-10-cutover-runbook.md`.
2. Provision Vercel and Fly per `phase-09-deployment-setup.md`, and confirm a
   preview plays a multiplayer game against the deployed Fly instance.
3. Dry-run the rollback (10.10), outside playing hours.
4. Execute the runbook (10.11).
5. Phase 11 — internationalisation. French comes back as a real locale, and
   step 11.5 owns the `lang` attribute and the per-locale SEO that steps 8.10
   and 10.0 deliberately left alone.

## Commands to resume

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"   # see below
pnpm install

docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=wikifake -e POSTGRES_DB=wikifake postgres:17-alpine
docker run -d -p 6379:6379 redis:8-alpine
export DATABASE_URL=postgres://postgres:wikifake@localhost:5432/wikifake
export REDIS_URL=redis://localhost:6379
pnpm migrate

pnpm test && pnpm typecheck && pnpm lint    # what CI runs
pnpm e2e                                    # the browser journeys
pnpm check                                  # before asking for a merge
```

Read first, in this order:

```
plans/README.md                             # where the project stands
plans/rewrite/phase-10-cutover.md           # the step table
plans/rewrite/phase-10-cutover-runbook.md   # the only thing left to do
plans/current-state/                        # the stack as it actually is
```

## Technical notes

- **`nvm use` does not take effect in a non-interactive shell here.** It reports
  "Now using node v22" and `node -v` still answers v20, so pnpm fails with
  `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` — which reads as a broken install
  rather than a `PATH` problem. Export the path, as above.
- **The tests skip rather than fail without Postgres and Redis.** ~250 cases. A
  green summary from such a run looks exactly like a complete one; the output
  says `0 skipped` when it was real.
- **`FLY_GIT_COMMIT` is a build argument, not a platform variable.** Fly injects
  no commit of its own. An image that baked none answers an empty string and
  the probe waits for a match that cannot come.
- **`auto_stop_machines = false` on Fly.** A stopped machine drops every socket
  it was holding, and the players do not come back because a health check woke
  it up.
- **The realtime health check is `/ping`, not `/api/health`.** The platform asks
  whether the process answers; a probe that read the database would report the
  service down when only the database is.
- **`NEXT_PUBLIC_REALTIME_URL` is inlined at build time.** Changing the variable
  without redeploying changes nothing.
- **`--ignore-scripts` everywhere** — CI, `vercel.json`, and
  `apps/realtime/Dockerfile`, which is the only Dockerfile left. `@sentry/cli`
  downloads a binary at install time and nothing in either build needs it;
  `pnpm-workspace.yaml`'s `allowBuilds` holds the exception for the day a
  sourcemap upload does.
- **The `guard` job is not decorative.** Its push/PR deduplication is what keeps
  a phase pull request towards the umbrella from losing all its checks. A
  `fix(ci)` patch was already paid to learn that.
