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

- Working tree clean, everything pushed.
- **`main`:** `92375d1` — eight pull requests, live and verified route by route.
- **`staging`:** `63b9b75` — `main`, plus #125 (the documentation correction) and
  #126 (the socket service on Render).
- **#127 is the promotion, and it is stuck.** Not on its own contents: on
  `5b8a202`, #125's squash commit, whose subject is 89 characters against the
  72-character limit. The conformance job walks every commit in the range, so a
  commit that is already merged blocks the promotion from a position where
  nothing can edit it. See `plans/current-state/06-structural-debt.md`.
- **The fix is pushed and proved:** `fix/staging-conformant-history` (`f08ab73`)
  is byte-for-byte `staging`'s tree with two conformant subjects. The conformance
  loop was replayed over both: it passes there, fails on `staging`.
- **Progress lives in `plans/README.md`** and the step table in
  `plans/rewrite/phase-10-cutover.md`. Those two, and nowhere else.

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

## The batch of eight ✅ — all merged and live

#124 the container fix, #123 the deny-list rules, #116/#118/#119/#120 four action
bumps, #117 gitleaks 2 → 3, promoted by #122. `revu` was applied by the owner on
each; the merges were carried out by Claude Code at the owner's explicit
instruction, with a disclosure comment per pull request.

Three frictions worth knowing, all structural rather than one-off:

- **An agent cannot apply `revu`.** The permission layer refuses
  `gh pr edit --add-label` outright, independently of `.claude/settings.json` —
  which was not even loaded, the worktree having started on the pre-rewrite tree.
  `gh pr merge` was **not** refused: the boundary that held is the one on the
  attestation, not on the merge. A force-push to a protected branch is refused
  too, which is why step 1 below needs a human.
- **The `gh` token has `repo` but not `workflow`**, so merging a pull request
  touching `.github/workflows/` is refused intermittently.
  `gh auth refresh -h github.com -s workflow` in a real TTY fixes it; repository
  auto-merge is disabled, so that is not a way around.
- **The ruleset requires branches to be up to date**, and dependabot does not
  rebase fast enough to follow a batch. Each was rebased by hand.

**#116, #119 and #120 merged with two required checks that never ran** —
`Does this PR follow the rules?` and `Secret scan` report only `skipping` on
dependabot heads, and GitHub counts that as satisfied. The debt register's
"A skipped run satisfies a required check", met in practice.

## Blocked ❌ — the socket service, so multiplayer does not work

`apps/realtime` has never been deployed. **Fly.io is abandoned: it asks for a
payment card.** #126 retargets step 9.8 to Render's free tier — WebSockets are
supported there, and the blueprint is committed as `render.yaml`.

**The image is proved, by running it.** Built from `apps/realtime/Dockerfile`
against Postgres and Redis: starts as `USER node`, `/ping` answers,
`/api/health` answers the injected `RENDER_GIT_COMMIT` verbatim — the mechanism
`deploy-check` compares — and a WebSocket upgrade opens from the configured
origin while a foreign one gets 403. **Not** proved: the blueprint itself, which
Render validates only at sync time.

The dashboard half: *New → Blueprint* on the repository; give the four
`sync: false` secrets — `DATABASE_URL`, `GOOGLE_GENERATIVE_AI_API_KEY`,
`SENTRY_DSN`, and `BETTER_AUTH_SECRET`, **which must equal the web app's** or a
session minted by one is refused by the other; then `NEXT_PUBLIC_REALTIME_URL`
on Vercel **and redeploy** (inlined at build time), and the
`REALTIME_DEPLOY_URL` repository variable so the probe covers it.

The free tier sleeps after fifteen minutes and its Key Value has no persistence,
so round timers no longer survive a redeployment — both in `05-known-debt.md`.

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

1. **Unblock #127**, one of two ways. Either move `staging` onto the corrected
   history — `git push --force-with-lease origin
   origin/fix/staging-conformant-history:staging`, which needs an administrator
   because the ruleset refuses a force-push — or merge #127 with administrator
   privileges and accept one non-conformant commit in `main` for good. The first
   leaves the record clean, the second is one click; either way it is one-time,
   the next promotion starting from a new base.
2. Label and merge #127, then confirm `/api/health` answers the new `main`.
3. **Sync the Render blueprint** — the socket service, and the last thing between
   the project and a working multiplayer. Details under "the socket service"
   above; the blueprint has never been synced, which is the one thing #126 could
   not prove.
4. Play a four-player round against the deployed service.
5. Move the domain and suspend the old Render service, per the cutover runbook.
6. Phase 11 — internationalisation. French returns as a real locale, and step
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
- **Render injects `RENDER_GIT_COMMIT` itself.** `deployedCommit` had to learn
  the name; `initSentry` gated its release on `FLY_APP_NAME`. Silent both: #126.
- **The realtime container runs `tsx` directly, not `pnpm start`.** Two reasons,
  both in #124's description. Do not tidy it back.

---
*Generated by the `ff` skill — Claude Code session*
