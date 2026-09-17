# Session handover — 2026-09-17

> Written in English, like everything else here (`CLAUDE.md`). Replaces the
> handover of 2026-09-16; everything it left open is restated below.

## Read this first

**The promotion is still pending, and it now carries 34 commits and the same
two migrations.** Nothing in the deploy path applies a migration —
`08-toolchain-debt.md` checked that rather than assumed it — so merging
`staging` into `main` without applying them first is a 500 on the home
dashboard for everybody, because that is the screen that reads the new tables.

What the two do, so the order is obvious rather than trusted:

- **`0021`** creates `daily_article` — the table track N's article of the day
  claims a row in each morning.
- **`0022`** adds `game.daily_day`, a foreign key **to that table**. It cannot
  be applied first.

```bash
# The order is not negotiable: schema, then code.
psql "$DATABASE_URL" -c 'select count(*) from drizzle.__drizzle_migrations;'
DATABASE_URL='<the Neon one>' pnpm migrate
```

Then the promotion, **merged and never squashed** — see *The merge method*.

## What this session did

It read the handover, found it three tracks stale, and then closed the two
findings track O had deliberately left. **Track P, three steps, all merged**
(#304 the sheet, #305, #306, #307), plus #303 and #308.

| | What a player gets |
|---|---|
| P.1 | a reconnection loop that stops when stopping is the truth, instead of asking once a second for ever from every open tab |
| P.2 | a card, with the room code and two ways out, instead of a badge over a roster that froze ten minutes ago |
| P.3 | a room link opened cold asks for a nickname, instead of waiting for ever on *en attente* |

**`12-realtime-debt.md` is empty.** All seven entries found on 16 September are
closed — five by track O, two by track P — each with a test that fails without
its fix, checked by removing the fix. The file says it is empty rather than
being deleted: five other registers name it in their tables.

**Three things went wrong in the doing, and they are the useful part:**

- P.3's first implementation flashed the nickname prompt at a player who had
  just typed one. Caught by 9.5's own `reads the nickname the entry screen
  wrote on its way out` — the test was already there, waiting for exactly that
  mistake. The state now carries *which room* the name was read for.
- One of P.2's five tests passed without the fix: it asserted the room code was
  on screen *anywhere*, which the room's own header satisfied while the card
  was missing entirely. A test that agreed with the defect. **Check each test
  against the absence of the piece it covers, not against the whole change.**
- P.1 and P.2 each owed `12-realtime-debt.md` the removal of an entry and
  neither paid it. P.3 paid both.

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

## Outstanding

**The owner's, and nothing in this repository can do them.**

1. **Apply `0021` and `0022`** before the promotion — above.
2. **The merge-method setting** — `Settings → General → Pull Requests`, merge
   commits only, or squash disallowed where the base is `main` or `staging`.
   Until then every promotion is one click from a broken graph.
3. **Grant the panel to `admin.wikifake@gmail.com`.** The `admin` table is
   empty, so `/admin` answers 404 to everybody, the owner included.
   `product/09-admin-role.md` carries the order: **sign in through Google
   first**, because until the account exists the insert matches nothing and
   says so by inserting nothing. No redeploy — `isAdmin` is a lookup per page
   load.
4. **Set the two cost rates in Vercel** — `MODEL_INPUT_COST_PER_MTOK=0.215` and
   `MODEL_OUTPUT_COST_PER_MTOK=1.29`. Converted at 0.861 USD→EUR **on
   13 September 2026 — read the date before trusting the number.**

**Then:**

5. C.7's device measurement — `product/03-landing-budget.md`, steps 1–6.
6. Have `/privacy` and `/terms` read by somebody legal. 11.10 deliberately did
   not touch `legal.json`: 2039 words of policy want a lawyer.
7. **Make `until` say what it timed out *in*** — `10-test-debt.md`'s newest
   entry. The deadline has been raised once already and the failure came back
   at the higher number; a third raise moves it again.
8. At leisure: the chat rail covering a card border at 360 px, and the
   per-package Redis index (`10-test-debt.md`).

**The day a domain is bought**, in this order: remove it from Render first, add
it to Vercel, point the registrar at what Vercel asks for; add
`https://<domain>/api/auth/callback/google` to the Google console and change
`BETTER_AUTH_URL` and `NEXT_PUBLIC_SITE_URL`; set `NEXT_PUBLIC_REALTIME_URL`
and **redeploy**, since it is inlined at build time; add the origin to
`REALTIME_ALLOWED_ORIGINS` on Render; set `WEB_DEPLOY_URL` and
`REALTIME_DEPLOY_URL` in GitHub and delete `DEPLOY_URL` and
`STAGING_DEPLOY_URL`.

**Three a session cannot fix:** the `rules.yml` concurrency defect; `Human
review` failing on every pull request because the label it waits for was
retired in #150; and a rollback needing `DEPLOY_URL` recreated.

## The merge method, which is still one click from repeating

`staging` → `main` and a realign are **merge commits**, and the button keeps
choosing squash. Merge those two from the command line:

```bash
gh pr merge <n> --merge --delete-branch --admin
```

Before opening a promotion, ask the promotion rather than the graph:

```bash
git merge-tree --write-tree origin/main origin/staging >/dev/null || echo 'realign first'
```

## Read this before trusting a green

- **The suites skip ~250 cases without Postgres and Redis** and still report
  success. A real run says `0 skipped`.
- **A green suite can still fail the job**: Vitest exits non-zero on an
  unhandled error with no failing case. Read the `Errors` line.
- **`until` timed out again on 2026-09-17**, at its raised eight-second
  ceiling, on #305 — a diff touching only `apps/web` and `plans/`. That is the
  fifth time and the second at eight seconds; the count is now in
  `10-test-debt.md`. **Re-run before believing it**, and do not raise it again.
- **`pnpm format:check` is its own gate** — `pnpm check` and `turbo run lint`
  do not run Prettier, and CI does. It caught a straight apostrophe in French
  copy this session: the catalogue wants `l’accueil`, never `l'accueil`.
- **Turborepo replays greens it never ran**: `pnpm exec turbo run <task>
  --force`.
- **One browser journey can be run on its own**, which is worth knowing before
  running all of them: `pnpm --filter @wikifake/e2e exec playwright test
  specs/<file>` — about 1.4 minutes, most of it the Next build.
- **`pnpm e2e` leaves keys in Redis**: `redis-cli FLUSHALL` between it and
  `pnpm test`.
- **`next dev` needs `--webpack`** — Turbopack chokes on this codebase's
  `.js`-suffixed TypeScript imports — and it writes an untracked
  `apps/web/AGENTS.md` and `apps/web/CLAUDE.md` each time. Delete them; the
  pre-commit hook scans untracked markdown.

## Commands to resume

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"   # nvm use is a no-op here
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
plans/product/17-recovery.md              # the track that shipped last
plans/product/09-admin-role.md            # the grant, and why it is a human action
```

---
*Written by Claude Code, from a session that emptied a register.*
