# Session handover — 2026-09-16

> Written in English, like everything else here (`CLAUDE.md`). Replaces the
> handover of 2026-09-15; everything it left open is restated below.

## Read this first

**The promotion is still pending, and it now carries 28 commits and the same two
migrations.** Nothing in the deploy path applies a migration —
`method/01-git-flow.md` checked that rather than assumed it — so merging
`staging` into `main` without applying them first is a 500 on the home dashboard
for everybody, because that is the screen that reads the new tables.

What the two actually do, so the order is obvious rather than trusted:

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

It began as a review, asked for after the multiplayer was reported as buggy and
the API as slow, and it turned into track O. **Every finding was reproduced
rather than argued about**, and every fix carries a test that fails without it —
checked by removing the fix, not by assuming.

**Six defects, and they shared a property worth remembering: each was a failure
the comment directly above the code said was handled.** `redis.ts` promised a
connection "reopened after a failure" and reopened nothing. `server.ts` guarded a
generation against a failure a hang never produces. And the suite was green — all
1935 cases — while all six were true.

| | What it did to a player |
|---|---|
| O.1 | two bytes of invalid UTF-8, from any client, killed the process and every room on it |
| O.2 | a tab closed during the join locked the nickname against its own owner and left a phantom who never readies, so the round never started |
| O.3 | one dropped Redis and the instance answered *"Ce salon n'est pas ouvert"* to players sitting in the room, until it restarted |
| O.4 | a hang is not a rejection: the room waited in `generating` for its idle alarm, an hour later |
| O.5 | a mouse move rewrote 20.3 KiB that the reducer had not touched, and burnt a revision a real event could lose |
| O.6 | six `session`+`user` reads on one page load |

Measured before and after, four players at the clients' own pacing, four seconds:
**260 revisions and 5.15 MiB written became 0 and 0.** Session reads per
signed-in page: **6 → 2**, which is the floor.

**Step 11.10 — the French catalogue, read as prose.** 827 messages, one defect: a
room was a `salle` in twelve messages and a `salon` in eighteen, and the two met
within seconds. Three other suspicions were artefacts of counting words instead
of reading them, and `i18n/glossary.test.ts` carries the dismissals so nobody
repeats the afternoon.

## Three decisions open to a veto

Each is one line to reverse, and each is argued in its step sheet rather than
here:

1. **`cookieCache` refused**, though it would take those last two queries to
   nought — `gate.ts`'s own position on never caching identity into a cookie, and
   the anonymous plugin makes it worse.
2. **The socket error is swallowed, not logged.** `server.ts` owns no logger by
   design. The diagnosis lost is recorded rather than pretended away.
3. **The generation deadline is 45 seconds**, in `@wikifake/article` rather than
   `@wikifake/domain` — the workspace graph would refuse that edge.

## Outstanding

**The owner's, and nothing in this repository can do them.**

1. **Apply `0021` and `0022`** before the promotion — above.
2. **The merge-method setting** — `Settings → General → Pull Requests`, merge
   commits only, or squash disallowed where the base is `main` or `staging`.
   Until then every promotion is one click from a broken graph.
3. **Grant the panel to `admin.wikifake@gmail.com`.** The `admin` table is empty,
   so `/admin` answers 404 to everybody, the owner included.
   `product/09-admin-role.md` carries the order: **sign in through Google
   first**, because until the account exists the insert matches nothing and says
   so by inserting nothing. No redeploy — `isAdmin` is a lookup per page load.
4. **Set the two cost rates in Vercel** — `MODEL_INPUT_COST_PER_MTOK=0.215` and
   `MODEL_OUTPUT_COST_PER_MTOK=1.29`. Converted at 0.861 USD→EUR **on
   13 September 2026 — read the date before trusting the number.**

**Then:**

5. C.7's device measurement — `product/03-landing-budget.md`, steps 1–6.
6. Have `/privacy` and `/terms` read by somebody legal. 11.10 deliberately did
   not touch `legal.json`: 2039 words of policy want a lawyer, not a French
   reader.
7. **Two findings recorded and deliberately not fixed**, both in
   `current-state/12-realtime-debt.md`: the client reconnects once a second for
   ever with no backoff, and a tab with no nickname waits on a badge reading
   *en attente*. Each needs a **screen** rather than a constant, which is a
   product decision track O refused to make in passing.
8. At leisure: the chat rail covering a card border at 360 px, and the
   per-package Redis index (`10-test-debt.md`).

**The day a domain is bought**, in this order: remove it from Render first, add
it to Vercel, point the registrar at what Vercel asks for; add
`https://<domain>/api/auth/callback/google` to the Google console and change
`BETTER_AUTH_URL` and `NEXT_PUBLIC_SITE_URL`; set `NEXT_PUBLIC_REALTIME_URL` and
**redeploy**, since it is inlined at build time; add the origin to
`REALTIME_ALLOWED_ORIGINS` on Render; set `WEB_DEPLOY_URL` and
`REALTIME_DEPLOY_URL` in GitHub and delete `DEPLOY_URL` and `STAGING_DEPLOY_URL`.

**Three a session cannot fix:** the `rules.yml` concurrency defect; `Human
review` failing on every pull request because the label it waits for was retired
in #150; and a rollback needing `DEPLOY_URL` recreated.

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
- **A green suite can still fail the job**: Vitest exits non-zero on an unhandled
  error with no failing case. Read the `Errors` line — and note that step O.1's
  test asserts on `uncaughtException` for exactly that reason.
- **`pnpm format:check` is its own gate** — `pnpm check` and `turbo run lint` do
  not run Prettier, and CI does.
- **Turborepo replays greens it never ran**: `pnpm exec turbo run <task> --force`.
- **`until` reached its eight-second ceiling again** on this session's own pull
  request, on a commit that passed the same file five times locally. Recorded in
  `10-test-debt.md`. Re-run before believing it; raising the ceiling a third time
  would only move the number.
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
plans/product/16-hardening.md             # the track that shipped last
plans/product/09-admin-role.md            # the grant, and why it is a human action
```

---
*Written by Claude Code, from a session that was asked to look for bugs and found six.*
