# Session handover — 2026-09-17

> Written in English, like everything else here (`CLAUDE.md`). Second revision
> of the same day: tracks P and Q both shipped after the morning's version, and
> everything it left open is restated below.

## Read this first

**The promotion is still pending, and it now carries 42 commits and the same
two migrations.** Nothing in the deploy path applies a migration —
`08-toolchain-debt.md` checked rather than assumed — so merging `staging` into
`main` without applying them first is a 500 on the home dashboard for
everybody, because that is the screen that reads the new tables.

**`0021`** creates `daily_article`; **`0022`** adds `game.daily_day`, a foreign
key **to that table**, so it cannot be applied first.

```bash
# The order is not negotiable: schema, then code.
psql "$DATABASE_URL" -c 'select count(*) from drizzle.__drizzle_migrations;'
DATABASE_URL='<the Neon one>' pnpm migrate
```

Then the promotion, **merged and never squashed** — see *The merge method*.

## Track P, in the morning

It closed the two findings track O had deliberately left — a reconnection loop
that stops, a card instead of a badge over a frozen roster, and a room link
opened cold that asks for a nickname instead of waiting for ever on *en
attente*. #303 to #308, all merged.

**One lesson worth the whole section.** One of P.2's five cases passed without
the fix: it asserted the room code was on screen *anywhere*, which the room's
own header satisfied while the card was missing entirely. **Check each test
against the absence of the piece it covers, not against the whole change.**

## Track Q, and the regression it repaired

The afternoon was a review of the whole repository, asked for after track P.
It found five things; **three were reproduced with a probe before anything was
written down**, one was deduced and says so, and the first one was ours.

**Q.1 is the one to read.** P.1 bounded the client's retry at `GRACE_SECONDS`,
the domain's 30, dismissing the risk as *"not worth a protocol change for a
value nobody has ever set."* `render.yaml:70` has set
`REALTIME_GRACE_SECONDS = 90` since the service moved to Render, because that
host sleeps after fifteen minutes and wakes in about one — so for half a day a
lobby left alone showed every player *Connexion perdue* at thirty seconds
while the server held their seats for another sixty. The loop now caps its
**delay** and never its lifetime, and `patience.test.ts` reads `render.yaml`
so the client and the deployment cannot disagree in silence again.

| | What it did to the service |
|---|---|
| Q.2 | `void accept(...)` held nothing over a **Postgres** query: a database blink during a handshake ended the process, and every room on it |
| Q.3 | the departure chain's `.then(arm)` was unheld — every player leaving during a Redis outage made an unhandled rejection |
| Q.4 | a rejected `subscribe` left its placeholder, and the instance went **deaf for that room** until it restarted, Redis recovered or not |
| Q.5 | a socket that **threw** mid-join left a phantom in the roster — O.2's symptom, by the other door |

`12-realtime-debt.md` is empty again, and says why that is a claim about how
hard anybody looked rather than about the service: **eleven defects in two
days, every one a failure the comment directly above the code said was
handled.** Q.5 also moved `accept` into its own file, which was not in the
sheet: `server.ts` was at its 500-line cap with two steps still to write.

## Three decisions open to a veto

Each is one line to reverse, and each is argued in `product/17-recovery.md`:

1. **The retry budget is `GRACE_SECONDS`**, not a number chosen for the
   occasion: 1, 2, 4, 8 and a clamped 15 seconds, five attempts, the last
   landing on the deadline. Past it the seat is gone, so a socket that opens is
   a new player joining rather than a reconnection.
2. **`lost` takes the whole screen, including mid-round.** That is where a
   stale screen is most convincing and least true, which is the argument — but
   it does mean a player loses sight of the article they were reading.
3. **A tab with no nickname is asked, not redirected.** `/play` would throw the
   room code away, which is the one thing a player who followed a link cannot
   get back.
4. **The `lost` card appears after two minutes and the loop never stops** — a
   tab left open retries every fifteen seconds indefinitely, 1/15th of the
   original rate, with a screen that says so.
5. **Q.3 swallows a failed grace alarm**: what is lost is the eviction, so the
   player stays away in the roster until `room_idle` reaps the room.

## Outstanding

**The owner's, and nothing in this repository can do them.**

1. **Apply `0021` and `0022`** before the promotion — above.
2. **The merge-method setting** — `Settings → General → Pull Requests`, merge
   commits only, or squash disallowed where the base is `main` or `staging`.
   Until then every promotion is one click from a broken graph.
3. **Grant the panel to `admin.wikifake@gmail.com`.** The `admin` table is
   empty, so `/admin` answers 404 to everybody, the owner included.
   `product/09-admin-role.md` carries the order: **sign in through Google
   first**, or the insert matches nothing. No redeploy — `isAdmin` is a lookup
   per page load.
4. **Set the two cost rates in Vercel** — `MODEL_INPUT_COST_PER_MTOK=0.215` and
   `MODEL_OUTPUT_COST_PER_MTOK=1.29`. Converted at 0.861 USD→EUR **on
   13 September 2026 — read the date before trusting the number.**

**Then:**

5. C.7's device measurement — `product/03-landing-budget.md`, steps 1–6.
6. Have `/privacy` and `/terms` read by a lawyer — 11.10 left `legal.json`
   alone on purpose.
7. **Make `until` say what it timed out *in*** — `10-test-debt.md`. Raised
   once already and the failure came back at the higher number.
8. **Two routes call a paid model with nothing limiting who** —
   `05-known-debt.md`, found by the review of 2026-09-17. `game/start.ts`
   mints a guest and `flags.ts` accepts a null session; the cache is keyed on
   the topic, so a caller sending a new one each time misses every time. A
   limit is a policy, which is why it is recorded rather than fixed.
9. **The home reads a whole history for four rows**, and awaits the board
   before four reads it does not need — `09-query-debt.md`. Both cheap.
10. **Half the server's refusals are still English** — `solo.tsx` has the code
    in hand and shows the sentence.
11. At leisure: the chat rail at 360 px, and the per-package Redis index.

**The day a domain is bought**, in this order: Render first, then Vercel, then
the registrar; add `https://<domain>/api/auth/callback/google` to the Google
console and change `BETTER_AUTH_URL` and `NEXT_PUBLIC_SITE_URL`; set
`NEXT_PUBLIC_REALTIME_URL` and **redeploy**, since it is inlined at build
time; add the origin to `REALTIME_ALLOWED_ORIGINS` on Render; set
`WEB_DEPLOY_URL` and `REALTIME_DEPLOY_URL` in GitHub and delete `DEPLOY_URL`
and `STAGING_DEPLOY_URL`.

**Three a session cannot fix:** the `rules.yml` concurrency defect; `Human
review` failing on every pull request because the label it waits for was
retired in #150; and a rollback needing `DEPLOY_URL` recreated.

## The merge method, which is still one click from repeating

`staging` → `main`, a realign, **and an umbrella branch** are merge commits,
and the button keeps choosing squash. #312 was the third kind and was merged
from the command line for that reason.

```bash
gh pr merge <n> --merge --delete-branch --admin
# and before opening a promotion, ask the promotion rather than the graph:
git merge-tree --write-tree origin/main origin/staging >/dev/null || echo 'realign first'
```

## Read this before trusting a green

- **The suites skip ~250 cases without Postgres and Redis** and still report
  success. A real run says `0 skipped`.
- **A green suite can still fail the job**: Vitest exits non-zero on an
  unhandled error with no failing case. Read the `Errors` line.
- **`until` timed out again on 2026-09-17**, at its raised eight-second
  ceiling, on a diff touching no realtime code. Fifth time, second at eight
  seconds, counted in `10-test-debt.md`. **Re-run before believing it**, and
  do not raise it a third time.
- **`pnpm format:check` is its own gate** — `pnpm check` and `turbo run lint`
  do not run Prettier, and CI does. It caught a straight apostrophe in French
  copy: the catalogue wants `l’accueil`, never `l'accueil`.
- **A file over 500 lines is refused by the pre-commit hook** — `server.ts`
  hit it mid-track.
- **Turborepo replays greens it never ran**: `pnpm exec turbo run <task>
  --force`.
- **One browser journey can be run on its own**: `pnpm --filter @wikifake/e2e
  exec playwright test specs/<file>` — about 1.4 minutes, mostly the build.
- **`pnpm e2e` leaves keys in Redis**: `redis-cli FLUSHALL` between it and
  `pnpm test`.
- **`next dev` needs `--webpack`** — Turbopack chokes on this codebase's
  `.js`-suffixed TypeScript imports — and it writes an untracked
  `apps/web/AGENTS.md` and `apps/web/CLAUDE.md` each time. Delete them; the
  pre-commit hook scans untracked markdown.

## Commands to resume

```bash
# `nvm use` is a no-op here. Since 2026-09-17 the path is also in the agent's
# own settings `env`, so a fresh session may already have it.
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
pnpm install && pnpm hooks

docker start wf-pg wf-redis
export DATABASE_URL='postgres://postgres:wikifake@localhost:5432/wikifake'
export REDIS_URL='redis://localhost:6379'
pnpm migrate

pnpm exec turbo run typecheck lint --force
pnpm exec turbo run test --force --concurrency=1   # a real run says 0 skipped
pnpm format:check
```

Read first, in this order:

```
plans/README.md                           # where every track stands
plans/current-state/11-promotion-debt.md  # before merging to main or staging
plans/product/18-resilience.md            # the track that shipped last
plans/product/09-admin-role.md            # the grant, and why it is a human action
```

---
*Written by Claude Code, from a session that emptied a register twice.*
