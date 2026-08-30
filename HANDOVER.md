# Session handover — 2026-08-30

> Written in English, like everything else in this repository (`CLAUDE.md`).
>
> Replaces the handover of 2026-08-27, which was already three merges behind: it
> described #127 as stuck and the socket service as never deployed. Both were
> resolved on 2026-08-29, by #142 and #144.

## Context

The rewrite is finished and in production. This session closed phase 6, recorded
what phases 9 and 10 had actually done, and found one thing nobody was watching:
**the deploy probe for production has never existed, and the probe that does run
points at a service suspended on purpose.**

## State at the pause

- Working tree clean, everything pushed.
- **`main`:** `c268a66` — served by Vercel, verified over HTTP this session.
  **`staging` is five commits ahead of it and has not been promoted.**
- **`staging`:** everything below, merged this session.

| PR | Subject |
|---|---|
| #146 | `fix(ui)` — the light palette passes every contrast pair |
| #147 | `docs` — close 9.10, and say what the ruleset actually enforces |
| #148 | `docs` — the cutover's unfinished tail, and 10.10 rescoped |
| #150 | `chore(rules)` — let agents merge, and retire the `revu` label |
| #149 | `docs` — this handover |

- **Progress lives in `plans/README.md`** and the step tables in the phase files.
  Those, and nowhere else.

## Read this before trusting a `revu` label

The rule that an agent never labels, reviews or merges a pull request **ended on
2026-08-30**, by the owner's decision, and `.claude/settings.json` now allows
those verbs. #150 carries the reasoning; the short version is that the gate was
already inert — the ruleset's bypass actor meant `Human review` never blocked the
account doing the merging — while still costing one manual gesture per branch.

**Every pull request in this session was labelled and merged by Claude Code, and
no human read any of them before they merged.** Each carries a disclosure comment
saying so. Wherever the label appears from now on it means *the pull request was
ready to merge*, not that anybody read it, and it must not be cited as review.

Getting a real attestation back means a distinct identity for agents — machine
account or GitHub App — with required approvals at 1 and the bypass actor
removed. Not reinstating the ceremony.

## What works ✅

Both services live, both serving the same commit — checked with `curl`, not
inferred:

```
wikifake.vercel.app/api/health              commit c268a66 = main exactly
wikifake-realtime.onrender.com/api/health   commit c268a66   (24 s cold start)
```

The full suite: **2,016 unit and integration cases, 0 skipped**, with Postgres
and Redis up. `typecheck`, `lint`, `format:check` and `build` green, all forced
past the Turbo cache — the first run of the session was `FULL TURBO` and proved
nothing.

**Phase 6 is closed.** The light palette failed seven contrast pairs, three of
them below 3:1, and the worst was the debrief's MISSED verdict in amber on amber
at 2.56. Five solids were darkened by the smallest factor that reaches the
target, hue and saturation untouched, no wash moved; the alternative of sharing
the correction with the washes was measured and rejected. 20/20 pairs pass in
both palettes now. #146.

## Corrected this session ✅

Step 9.10 was already complete — the ruleset carries the nine live check names,
verified against the API — and `phase-10-cutover.md` still claimed that
`apps/realtime` had never been deployed, eight days after it went live.
#147 and #148.

## Blocked ❌ — the deploy probe, and it is costing every push

```
DEPLOY_URL          = https://wikifake.onrender.com          suspended → 503
WEB_DEPLOY_URL      = (unset)                                production, unprobed
REALTIME_DEPLOY_URL = https://wikifake-realtime.onrender.com ✓ works
```

`WEB_DEPLOY_URL` was never set, so the probe job for the application users
actually reach **skips itself and reports success while checking nothing**.
`DEPLOY_URL` was never deleted, so the probe for the suspended Python service
runs, gets no answer for forty attempts, and fails — on **every push to `main`**.
Both promotions since the cutover, #143 and #145, carry that red.

This is step 6 of `plans/rewrite/phase-10-cutover-runbook.md`, left undone while
step 7 was done. The runbook predicted the symptom in its own words, and
`phase-10-cutover.md` lists it among its pitfalls. **The plan foresaw this twice
and it happened anyway** — which is the argument for reading the pitfalls list
before a cutover rather than after.

It is also why phase 9 is *not* marked done: its exit gate asks for a probe
working against both services, and only one does.

## Why the gate never held

The ruleset lists one bypass actor — the owner, `bypass_mode: always` — so every
required check is advisory for the account that merges. Measured, not supposed:
**#142 to #145 merged without the `revu` label**, #144 with `Human review`
reporting `failure`. Those four went through an empty required-checks list during
the rename window, so **they are not evidence that the gate works.** #147.

## Also outstanding

- **The public domain still points at Render**, which is suspended, so it
  answers nothing. `wikifake.vercel.app` does. Runbook step 5.
- **Step 10.10's dry run** — but it is cheaper than the sheet used to say. The
  service is suspended and answers `503` with `x-render-routing: suspend-by-user`,
  so half the run is already on record. The half with doubt in it — whether a
  suspended free-tier service comes back with the same image — **no longer
  touches production**. It reduces to: Resume → read `/api/health` → **write the
  `commit` down** → Suspend. That value is what runbook step 1 was supposed to
  capture and nobody did, so the procedure's own comparison currently has
  nothing to compare against.
- **The Google AI key from the 2026-08-27 transcript** — regenerate it in AI
  Studio if that was never done.
- `05-known-debt.md` is at **exactly 200 lines**, its cap, and so is
  `phase-09-observability-and-cicd.md`. A new entry in either needs a split or a
  trim first; the accessibility gap found this session went to
  `06-structural-debt.md` for that reason.

## Next steps, in order

1. **Promote `staging` to `main`.** Five commits are waiting, none of them
   promoted. The `deploy-check` probe will go red on that push — the probe
   section above says why, and it is not this batch's doing.
2. **Set the probe variables** — `WEB_DEPLOY_URL` to the production URL, and
   decide `DEPLOY_URL` together with the domain: it is also the rollback's probe,
   so deleting it is a step of the rollback in reverse. **This is the one thing
   an agent cannot do here**: `gh api` write verbs and `gh ruleset` stay denied,
   deliberately, and repository variables are set in the GitHub UI.
3. **Run 10.10's dry run** and write the commit into `phase-10-rollback.md`.
4. **Move the domain**, runbook step 5, and the probe follows it.
5. Phase 11's two open decisions: whether protocol and socket packages emit
   translatable *codes* rather than English sentences, and whether
   `not-found.tsx` / `error.tsx` get built so a French interface stops crashing
   in English.
6. Two accessibility journeys — reduced motion, 360 px — now that CI has a
   browser. `06-structural-debt.md`.

## Commands to resume

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"   # see below
pnpm install && pnpm hooks

docker run -d --name wf-pg -e POSTGRES_PASSWORD=wikifake -e POSTGRES_DB=wikifake -p 5432:5432 postgres:17-alpine
docker run -d --name wf-redis -p 6379:6379 redis:8-alpine
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
plans/rewrite/phase-10-cutover-runbook.md   # which of its steps actually ran
plans/method/03-infrastructure.md           # what the ruleset does and does not do
plans/current-state/                        # the stack as it actually is
```

## Technical notes

- **`nvm use` does not take effect in a non-interactive shell here.** It reports
  "Now using node v22" and `node -v` still answers v20, so pnpm fails with
  `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` — which reads as a broken install
  rather than a `PATH` problem. Export the path.
- **The tests skip rather than fail without Postgres and Redis**, ~250 cases. The
  output says `0 skipped` when the run was real; read that line before believing
  a green one.
- **Turborepo will replay a green it did not run.** `pnpm typecheck` answered
  `FULL TURBO` in 56 ms on a fresh worktree. `pnpm exec turbo <task> --force` is
  what actually executes; `pnpm <task> -- --force` passes the flag to `tsc` and
  fails.
- **A skipped probe reports success**, exactly like a skipped required check.
  That is how production went unprobed without anybody noticing.
- **A pull request title becomes a squash commit's subject** plus ` (#NNN)`, and
  the 72-character limit is checked on every commit in a promotion's range. Keep
  titles at **65 characters or fewer** — `06-structural-debt.md` has the story of
  the promotion this deadlocked.
- **`gh` has `repo` but not `workflow` scope**, so merging a pull request that
  touches `.github/workflows/` is refused intermittently.

---
*Written by Claude Code, from a session that read the repository before touching it.*
