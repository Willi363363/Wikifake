# Session handover — 2026-09-06, evening

> Written in English, like everything else in this repository (`CLAUDE.md`).
>
> Replaces the handover written earlier the same day, which closed track D.
> Everything it listed as outstanding is restated below.

## Context

Track C — the landing and its scroll scene. Five of its eight steps shipped this
session, and the debt register was split a third way to make room for what
building them turned up.

## State at the pause

- **`main`:** `0679acf` — the env loader reaching the db commands (#179). It does
  **not** carry track C: #179 promoted `staging` at `cfb9b8c`, before #178.
- **`staging`:** `d44d914` — track C's C.1 to C.5.
- **Two branches pushed, neither merged.** See "Where things stand" below.
- **`plans/README.md` carries the state of every track.** Nothing else does.

## What shipped

**Track C, steps C.1 to C.5** — five pull requests, #172 to #176, promoted to
`staging` as #178. The front door is `apps/web/src/landing/`: a document first,
and a scroll scene laid over it.

- **C.1** — the document. Headings, copy and the way in as plain HTML in both
  locales, before any camera existed. The demonstration quotes a real *Tour
  Eiffel* extract frozen at its `oldid`, which brought a real CC BY-SA
  obligation: the page renders the round's own `<Attribution>`, and the softer
  licence sentence the front door used to carry is **gone** rather than kept
  beside it.
- **C.2** — the stage. `position: sticky`, so nothing listens for a wheel event.
  Two of the three switches are CSS and hold before hydration; the third is a
  `<noscript>` block.
- **C.3** — depth as a vocabulary: `--depth`, `--arrive-from`, one `transform`.
- **C.4** — the collision. Beats 2 and 3 come out of one component with three
  fixed rows, so the false paragraph lands on the rectangle the true one held.
- **C.5** — the scoreboard assembles, one row at a time, the way in last.

**How each step was built, and what it got wrong first**, is in
`plans/product/03-landing-scene.md`. That file is the point of reading before
touching the scene.

## Where things stand

Two branches are pushed and neither is merged.

**#180 — `docs/debt-registers` to `staging`. Green, waiting on the `revu`
label.** Splits `06-structural-debt.md` a third way into `08-toolchain-debt.md`:
the shape of the repository stays, the commands you run move. Two entries move
unchanged, and the two findings that had nowhere to go are filed with them. All
four register files are under the cap.

**`fix/test-env-loading` — WIP, seven tests red, no pull request.** This is the
one thing genuinely unfinished, and it is the next session's first job.

`apps/web`, `packages/db` and `apps/realtime` now declare
`setupFiles: ['@wikifake/env/load']`, so `pnpm test` reads `.env.local` like the
four entry points do. Measured with nothing exported:

```
before   db  11 passed |  92 skipped     web  942 passed | 101 skipped
after    db 103 passed                   web 1036 passed |   7 failed
```

`packages/db` is whole. **Nobody has read the seven yet** — the session was
stopped at that line. They are in suites that have never run outside CI on this
machine, so a real defect and a fixture that only ever saw CI's database are
both live hypotheses. Read them before assuming either:

```bash
pnpm --filter @wikifake/web test 2>&1 | grep -A8 'FAIL '
```

## Outstanding, inherited and still open

- **Track C's last three steps.** C.6 is the audit of the reduced-motion path
  rather than its construction; **C.7 needs a real mid-range Android**, so it
  needs a person; C.8 is a social share image.
- **Step 10.10's dry run** — resume the suspended Render service, read
  `/api/health`, write the commit into `phase-10-rollback.md`, suspend.
- **Move the domain**, runbook step 5. The public domain still points at Render.
- **A rollback must recreate `DEPLOY_URL`.**
- **The Google AI key from the 2026-08-27 transcript**, if never regenerated.
- **The `rules.yml` concurrency defect.** Applying `revu` replaces the
  already-passing conformance and secret-scan contexts with `skipping`. Fixing
  it means editing `.github/workflows/`, and `gh` has no `workflow` scope.
- **Chat rail covers a card border at 360 px**; **`disabled:opacity-40`** is the
  one translucency the direction forbids.

## Next steps, in order

1. **Read the seven failures on `fix/test-env-loading`**, decide what they are,
   and finish or revert that branch. It is red on a branch nobody has reviewed.
2. **Merge #180** if the split reads right — it is green and documentation only.
3. **Track C.6**, the reduced-motion audit. Most of it exists already: the path
   was built first, on purpose, and `landing.spec.ts` asserts it in a browser.

## Commands to resume

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"   # nvm use is a no-op here
pnpm install && pnpm hooks

docker start wf-pg wf-redis
cp .env.example .env.local        # then fill in the Google key
pnpm migrate                      # works with nothing exported, since #177

pnpm dev                          # both services, no flags
pnpm test                         # read the skipped count
pnpm e2e                          # 35 browser journeys
```

Read first, in this order:

```
plans/README.md                        # where every track stands
plans/product/03-landing-scene.md      # how the scene was built, and its traps
plans/current-state/08-toolchain-debt.md
plans/current-state/07-local-setup.md
```

## Technical notes

- **`pnpm test` still needs `DATABASE_URL` and `REDIS_URL` exported on
  `staging`.** The fix is on `fix/test-env-loading` and is not merged. Read the
  `skipped` count until it is: a real run says `0 skipped`.
- **`pnpm e2e` leaves ~40 keys in Redis and the next `pnpm test` fails
  `broadcast.test.ts` on them.** `redis-cli FLUSHALL` between the two.
- **`reuseExistingServer` reuses a server you started by hand**, skipping the
  config's build and its whole `env` block with no line saying so. Stop any
  hand-started server before `pnpm e2e`. Both of these are in
  `08-toolchain-debt.md`, on branch `docs/debt-registers`.
- **A pull request title becomes a squash commit's subject** plus ` (#NNN)`.
  Keep titles at 65 characters or fewer.
- **`.env.local` is gitignored and is not committed.** The one in this worktree
  carries a placeholder Google key, so nothing here can generate a round.

---
*Written by Claude Code, from a session that measured before it wrote.*
