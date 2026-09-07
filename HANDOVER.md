# Session handover — 2026-09-07

> Written in English, like everything else in this repository (`CLAUDE.md`).
>
> Replaces the handover of 2026-09-06 evening. Everything it listed as
> outstanding and still open is restated below.

## Context

Track C finished, and track E went from nothing to four steps done. The session
also closed the branch that made `pnpm test` lie, and found — by reading the
write paths rather than assuming them — that a multiplayer round had never
reached Postgres at all.

## State at the pause

- **`main`:** `0679acf` (#179). It carries **none** of tracks C or E: that
  promotion was taken at `cfb9b8c`, before all of it.
- **`staging`:** `a473978` — everything below except E.3b.2.
- **One pull request open: #194**, green, and it must be merged. See below.
- **`plans/README.md` carries the state of every track.** Nothing else does.

## Read this first: three pull requests merged into the wrong branch

**#183, #184, #188 and #193 were merged into their own base branches instead of
`staging`.** Each time the work was stranded on a branch and had to be replayed;
each replay cost a rebase, a conflict resolution and a full re-verification.

The cause is the same every time: a **stacked** pull request keeps its base until
`gh pr edit <n> --base staging` actually lands, and merging before that puts it
into the branch below rather than into `staging`.

**#194 is the current instance.** Its base is already `staging`, so:

```bash
gh pr view 194 --json baseRefName -q .baseRefName   # must print: staging
gh pr merge 194 --squash --delete-branch --admin
```

The durable fix is not to stack. When a step depends on an unmerged one, either
wait for the merge or branch from `staging` and accept a one-line tracker
conflict — both are cheaper than a replay.

## What shipped

**Track C is done except one measurement.**

- **C.6** (#182) — the three degraded paths, each read as a document. It found
  the `<noscript>` revert reverting the stage and leaving every ramp inside it
  running: a browser with scripting off received beat 1 and **three blank
  screens**. One line fixes it — `--beat-progress: 0 !important` — because the
  scene at rest *is* the document.
- **C.7 + C.8** (#185) — the budget measured as a slope (60 frames and 480: the
  layouts must not scale), and the share card, generated per locale. The card it
  replaced was 1024×1024 in a 1.91:1 slot, French-only, off the direction, and
  wearing the Wikipedia globe.
- **C.7 is ⚠️, not ✅.** The structural half holds; the 60fps figure needs a
  phone. `plans/product/03-landing-budget.md` has the runbook.

**Track E: four steps and a fifth waiting to merge.**

- **E.1** (#187) — the guard on `BETTER_AUTH_URL`, whose localhost default would
  send every player who signs in with Google to their own machine, silently.
  ⚠️ until somebody creates the credentials.
- **E.2** (#188 → #190) — the sign-in and sign-up screens.
- **E.4** (#189) — `player_stats`, and the discovery that E.3b was missing.
- **E.5** (#191) — the profile screen.
- **E.3b.1** (#192) — a multiplayer round reaching the database at all.
- **E.3b.2** (#193 → **#194, open**) — the signed ticket that says whose round
  it was.

**`pnpm test` stopped lying** (#186). It never loaded `.env.local`, so 275 cases
skipped and the command reported success. A real run now says **0 skipped**, and
that is the number to read.

## What E.4 found, and why the plan grew a step

`apps/realtime` created a `game` row and a `participant` row per player and then
**never touched either again**. Every multiplayer round in Postgres was a game
nobody finished — no `submitted_at`, no score, no `ended_at`. The list had been
cut before anybody read `generation.ts` and `server.ts`, so it gained **E.3b**,
which turned out to be two steps. `plans/product/05-accounts-multiplayer.md` is
the whole record.

## Outstanding

**Needs a person, not a session:**

- **E.1's credentials** — Google console, then two variables in Vercel.
  `plans/product/05-accounts-oauth.md` has the runbook and the preview trap.
- **C.7's device measurement** — `plans/product/03-landing-budget.md`, steps 1–6.

**Inherited and still open:**

- **Step 10.10's dry run** — resume the suspended Render service, read
  `/api/health`, write the commit into `phase-10-rollback.md`, suspend.
- **Move the domain**, runbook step 5. The public domain still points at Render.
- **A rollback must recreate `DEPLOY_URL`.**
- **The Google AI key from the 2026-08-27 transcript**, if never regenerated.
- **The `rules.yml` concurrency defect** — applying `revu` replaces already
  passing contexts with `skipping`. `gh` has no `workflow` scope.
- **Chat rail covers a card border at 360 px**; **`disabled:opacity-40`** is the
  one translucency the direction forbids; **the beat margin** filed this session
  in `06-structural-debt.md`.

## Next steps, in order

1. **Merge #194**, checking its base first. Track E's statistics are incomplete
   until it lands: a room round is written down and attributed to nobody.
2. **E.3 — the unique pseudonym.** The last of track E that is code rather than
   a console. E.6 is now mostly *proved* rather than built: the guest half of
   `multiplayer-profile.spec.ts` is its exit condition for rooms.
3. **E.7 — export and delete.** An hour's work while the schema is small, per
   the track's own argument, and a week's once F, G and H reference a player.

## Commands to resume

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"   # nvm use is a no-op here
pnpm install && pnpm hooks

docker start wf-pg wf-redis
cp .env.example .env.local        # then fill in the Google key
pnpm migrate

pnpm exec turbo run typecheck lint test --force   # a real run says 0 skipped
pnpm e2e                                          # 61 browser journeys
pnpm format:check                                 # `pnpm check` and lint do NOT run Prettier
```

Read first, in this order:

```
plans/README.md                          # where every track stands
plans/product/05-accounts.md             # the track under way, and its sheets
plans/product/05-accounts-multiplayer.md # the step the list did not have
plans/current-state/08-toolchain-debt.md
```

## Technical notes

- **`pnpm format:check` is its own gate.** `pnpm check` is `checks.sh` and
  `turbo run lint` is eslint; **neither runs Prettier**, and CI's `Lint & format`
  job does. It cost a red pull request this session.
- **`pnpm e2e` leaves keys in Redis and the next `pnpm test` fails on them** —
  `redis-cli FLUSHALL` between the two. Reproduced this session at 52 keys.
- **A pull request title becomes a squash commit's subject** plus ` (#NNN)`.
  Keep titles at 65 characters or fewer.
- **`.env.local` is gitignored and is not committed.** The one in this worktree
  carries a placeholder Google key, so nothing here can generate a round.
- **The `revu` label records that a pull request was ready, never that anybody
  read it.** Do not cite it as review.

---
*Written by Claude Code, from a session that read the write paths.*
