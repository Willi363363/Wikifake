# Session handover — 2026-08-27 (evening)

> Written in English, like everything else in this repository (`CLAUDE.md`).
>
> Replaces the handover written earlier the same day, which said only step 10.11
> was left. That step is done: the rewrite is in production.

## Context

The WikiFake rewrite reached production this session. `main` serves a TypeScript
monorepo; Python and FastAPI are gone. What is left is the multiplayer half — the
socket service has never been deployed — and eight pull requests waiting on one
label each.

## State at the pause

- **Branch:** `docs/handover-phase-10`, rebased on `staging`. Working tree clean,
  everything pushed.
- **`main`:** `35e0a33` — the rewrite, live and serving. #122 promotes the batch
  below; until it merges, `main` is one batch behind `staging`.
- **`staging`:** `53e7284` — `main`, #121, and the seven pull requests merged
  this session.
- **Progress lives in `plans/README.md`** and the step table in
  `plans/rewrite/phase-10-cutover.md`. Those two, and nowhere else — and this
  session corrected both: they still said step 10.11 was left to do while
  production was already serving the rewrite.

## What works ✅

**Production is the new stack.** Verified over HTTP, not in a test:

```
/api/health   commit = 35e0a33 = main's SHA exactly
POST /api/game/start   a real round on "Everest": 100 paragraphs, 4 falsifications,
                       and no explanation, hint or position in the payload
/ /play /solo /robots.txt /sitemap.xml /ping   all 200
```

Solo is playable at **https://wikifake.vercel.app**. Neon Postgres (14 tables
migrated) and Upstash Redis are provisioned through the Vercel marketplace, which
set `DATABASE_URL` and `REDIS_URL` on all three environments itself.

The contract is checked off: every guarantee of
`plans/rewrite/01-contract-to-preserve.md` maps to a named test in
`plans/rewrite/phase-10-contract-map.md`. Eleven were re-verified against the
live deployment, including C3.1 — that `positions` designates the paragraphs
actually falsified, the most serious bug in this project's history.

`pnpm typecheck`, `lint`, `format:check` and `build` green; **1,899 unit and
integration cases and 11 browser journeys pass with nothing skipped**, which
needs Postgres and Redis up.

## The batch of eight ✅ — seven merged, #122 promotes them

`revu` was applied by the owner on each; the merges were carried out by Claude
Code at the owner's explicit instruction, with a disclosure comment per PR.

| PR | Subject |
|---|---|
| #124 | the container fix — `CMD` is now `node_modules/.bin/tsx src/main.ts` |
| #123 | short-flag gaps in the agent deny list, and the "no `revu`" rule |
| #116 | `actions/setup-node` 4 → 7 |
| #118 | `actions/checkout` 4 → 7 |
| #119 | `actions/cache` 4 → 6 |
| #120 | `actions/upload-artifact` 4 → 7 |
| #117 | `gitleaks-action` 2 → 3 — **changes the action behind a required check** |

Three frictions, all structural rather than one-off:

- **An agent cannot apply `revu`.** Claude Code's permission layer refuses
  `gh pr edit --add-label` outright, independently of `.claude/settings.json` —
  which was not even loaded, the worktree having started on the pre-rewrite tree.
  `gh pr merge` was **not** refused. The boundary that held is the one on the
  attestation, not the one on the merge.
- **The `gh` token has `repo` but not `workflow`**, so merging a PR touching
  `.github/workflows/` is refused intermittently. Five of these eight do.
  `gh auth refresh -h github.com -s workflow` in a real TTY fixes it;
  repository auto-merge is disabled, so it is not a way around.
- **The ruleset requires branches to be up to date**, and dependabot does not
  rebase fast enough to follow a batch. Each was rebased by hand before merging.

**#116, #119 and #120 merged with two required checks that never ran** —
`Does this PR follow the rules?` and `Secret scan` report only `skipping` on
dependabot heads, and GitHub counts that as satisfied. That is the debt
register's "A skipped run satisfies a required check", met in practice. The
branch-name rule would legitimately fail on a `dependabot/...` head, which is
probably why the filter exists.

## Blocked ❌ — Fly.io, so multiplayer does not work

`apps/realtime` has never been deployed. `flyctl v0.4.94` is installed at
`~/.fly/bin/flyctl` and is **not authenticated**:

```bash
~/.fly/bin/flyctl auth login
```

Two things to know before spending anything: **Fly asks for a card**, and
`fly.toml` deliberately runs a machine continuously
(`auto_stop_machines = false`, because a stopped machine drops every socket it
was holding). It is not free.

**The image is proved to work.** Built and run locally against Postgres and
Redis before deploying anything, which found two bugs that would have failed the
deployment — see #124. `--build-arg FLY_GIT_COMMIT` is confirmed to reach
`/api/health`, which is the whole mechanism `deploy-check` compares.

Once authenticated: deploy, `fly secrets set` the five values, set
`NEXT_PUBLIC_REALTIME_URL` on Vercel **and redeploy** (it is inlined at build
time), add the production origin to `REALTIME_ALLOWED_ORIGINS`.

## Also outstanding

- **The public domain still points at Render**, which is suspended, so the old
  address does not answer. `wikifake.vercel.app` does.
  `plans/rewrite/phase-10-cutover-runbook.md` has the rest.
- **Step 10.10's dry run** — the rollback procedure is written
  (`plans/rewrite/phase-10-rollback.md`) but never exercised. Its one uncertain
  claim is whether a suspended Render service comes back with the same image.
- **The Google AI key is in this session's transcript.** It was pasted through a
  `!` command, which echoes. Regenerate it in AI Studio.
- `.env`, `.env.local` and `.env.vercel` hold real credentials locally. All three
  are gitignored — verified with `git check-ignore --no-index`, the only form
  that answers for a tracked path.

## Next steps, in order

1. Merge #122 — it promotes the seven above to `main`. It touches
   `.github/workflows/`, so expect the scope refusal and retry, or merge it in
   the browser.
2. **Watch `Secret scan` on the next pull request.** #117 swapped the gitleaks
   action for a new major version and that job never ran on #117 itself. If v3
   misbehaves, a required check fails on every PR and everything blocks; revert
   #117 rather than debug under pressure.
3. `~/.fly/bin/flyctl auth login`, then deploy the socket service (step 9.8).
3. Play a four-player round against the deployed service.
4. Move the domain and suspend Render properly, per the cutover runbook.
5. Phase 11 — internationalisation. French returns as a real locale, and step
   11.5 owns the `lang` attribute and the per-locale SEO that steps 8.10 and
   10.0 deliberately left alone.

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
plans/rewrite/phase-10-cutover-runbook.md   # what is left of the cutover
plans/current-state/                        # the stack as it actually is
```

## Technical notes

- **`nvm use` does not take effect in a non-interactive shell here.** It reports
  "Now using node v22" and `node -v` still answers v20, so pnpm fails with
  `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` — which reads as a broken install
  rather than a `PATH` problem. Export the path.
- **The tests skip rather than fail without Postgres and Redis.** ~250 cases. The
  output says `0 skipped` when the run was real; read that line before believing
  a green one.
- **A skipped run satisfies a required check.** GitHub treats it as passing, and
  that is how the rewrite reached `main` on a conformance check that had failed
  on its previous run. #121 fixes the immediate cause; the general shape is in
  `plans/current-state/05-known-debt.md`.
- **A deny-list pattern blocks a spelling, not an action**, and a file that is
  never loaded blocks nothing at all. #123 closes the four verbs; see the
  frictions above for how little that guaranteed.
- **The ruleset's required checks are now the nine live names**, and a required
  context that never reports does not fail — it stays pending.
- **`vercel.json`'s root directory is `apps/web`**, not the repository root.
  Vercel looks for `next` in the root directory's `package.json`, and
  `framework: "nextjs"` does not substitute for that detection.
  `outputDirectory` is resolved against the root directory, hence `.next`.
- **`turbo.json` must declare what the build reads.** Turborepo strips what it
  has not been told about, and every `NEXT_PUBLIC_*` is inlined at build time —
  an undeclared `NEXT_PUBLIC_REALTIME_URL` reaches the browser empty, every room
  fails to connect, and no build complains.
- **`FLY_GIT_COMMIT` is a build argument, not a platform variable.** Fly injects
  no commit of its own.
- **The realtime container runs `tsx` directly, not `pnpm start`.** Two reasons,
  both in #124's description. Do not tidy it back.

---
*Generated by the `ff` skill — Claude Code session*
