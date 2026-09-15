# Session handover — 2026-09-15

> Written in English, like everything else here (`CLAUDE.md`). Replaces the
> handover of the same day's morning; everything it left open is restated below.

## Read this first

**A promotion is pending and it carries two migrations.** `staging` is fifteen
commits ahead of `main` with `0021` and `0022` in them, and **nothing in the
deploy path applies a migration** — `01-git-flow.md` checked that rather than
assumed it. Merging the promotion without applying them first is a 500 on the
home dashboard for everybody, because that is the screen that reads the new
tables.

```bash
# The order is not negotiable: schema, then code.
psql "$DATABASE_URL" -c 'select count(*) from drizzle.__drizzle_migrations;'
DATABASE_URL='<the Neon one>' pnpm migrate
```

Then the promotion, **merged and never squashed** — see *The merge method* below.

## What the day did

**The morning repaired a graph.** Four squashed promotions and realigns had left
`main` not descending from `staging`; it took five pull requests, and the repair
only held when the merge was made from the command line. `11-promotion-debt.md`
is a new register that carries the whole of it.

**Track M — badges.** Fifteen rungs over five ladders, derived from
`player_stats` and never stored, so the catalogue grows with no migration. The
price is written into the track: nothing knows *when* a badge was crossed, so
nothing can announce one. On the profile, with the rung underneath.

**Track N — the article of the day.** One article a day, the same for everybody,
with its own board. Seven steps: the table and the claim, the subject chosen from
Wikipedia's most-read list, the read path, the round, the board, the entry point,
and the cron.

**Tracks F.8 and F.9 — quests.** The draw was 3 of 5 and a player saw one of ten
possible days; it is 3 of 8 now, and two new tallies read columns the schema had
carried since phase 2.

## The merge method, which is still one click from repeating

`staging` → `main` and a realign are **merge commits**, and the button keeps
choosing squash — it remembers the last method used per repository, and squash is
right for every other branch here. Merge those two from the command line:

```bash
gh pr merge <n> --merge --delete-branch --admin
```

**The durable fix is a repository setting and it is the owner's**: *Settings →
General → Pull Requests*, merge commits only, or squash disallowed where the base
is `main` or `staging`. Nothing in the repository can make it.

Before opening a promotion, ask the promotion rather than the graph:

```bash
git merge-tree --write-tree origin/main origin/staging >/dev/null || echo 'realign first'
```

`merge-base --is-ancestor` is the wrong question and was briefly the recommended
one: it is false after *every* promotion until a realign nobody can run.

## Outstanding

**The owner's, and nothing in this repository can do them.**

1. **Apply `0021` and `0022`** before the promotion — above.
2. **The merge-method setting** — above. Until then every promotion is one click
   from a broken graph.
3. **Grant the panel to `admin.wikifake@gmail.com`.** The `admin` table is empty,
   so `/admin` answers 404 to everybody, the owner included.
   `plans/product/09-admin-role.md` carries the order: **sign in through Google
   first**, because until the account exists the insert matches nothing and says
   so by inserting nothing. Then the insert and the read-back, in the Neon
   console. No redeploy — `isAdmin` is a lookup run on every page load.
4. **Set the two cost rates in Vercel** — `MODEL_INPUT_COST_PER_MTOK=0.215` and
   `MODEL_OUTPUT_COST_PER_MTOK=1.29`. `gemini-3.1-flash-lite` at $0.25/$1.50 per
   million, converted at 0.861 USD→EUR **on 13 September 2026 — read the date
   before trusting the number**. K.9b in `12-admin-pages.md`.

**Then:**

5. C.7's device measurement — `plans/product/03-landing-budget.md`, steps 1–6.
6. Read the French catalogue as a French reader (`phase-11-i18n.md`). Tracks M
   and N added about thirty messages between them.
7. Have `/privacy` and `/terms` read by somebody legal.
8. At leisure: the chat rail covering a card border at 360 px, and the
   per-package Redis index (`10-test-debt.md`).

**The day a domain is bought**, in this order: remove it from Render first, add
it to Vercel, point the registrar at what Vercel asks for; add
`https://<domain>/api/auth/callback/google` to the Google console and change
`BETTER_AUTH_URL` and `NEXT_PUBLIC_SITE_URL`; set `NEXT_PUBLIC_REALTIME_URL`
and **redeploy**, since it is inlined at build time; add the origin to
`REALTIME_ALLOWED_ORIGINS` on Render; set `WEB_DEPLOY_URL` and
`REALTIME_DEPLOY_URL` in GitHub and delete `DEPLOY_URL` and `STAGING_DEPLOY_URL`;
open a throwaway pull request and confirm nothing stays pending.

**Advertising stays deferred** — `11-deferred.md` carries the arithmetic.

**Three a session cannot fix:** the `rules.yml` concurrency defect; `Human
review` failing on every pull request because the label it waits for was retired
in #150 and `gh` has no `workflow` scope; and a rollback needing `DEPLOY_URL`
recreated.

## What is worth knowing before writing code here

**Four guards caught what targeted tests did not, in one day**, and each exists
because somebody was caught out at exactly that spot. Run the whole suite before
asking for a merge, not the folder you touched:

- `indexing.test.ts` — a new page route with no crawler decision.
- The message catalogue's own types — a new error code with no translation.
- `inferred-types.test.ts` — a new contract file outside its hand-written list.
- `route-parity.test.ts` — a route served under a method the catalogue does not
  describe. It caught `/api/cron/daily` shipping as a `POST` when Vercel's
  scheduler sends a `GET`: the cron would have answered 405 every morning and
  **nothing would have said a word**, because the read path covers every day
  anyway.

## Read this before trusting a green

- **The suites skip ~250 cases without Postgres and Redis** and still report
  success. A real run says `0 skipped`.
- **A green suite can still fail the job**: Vitest exits non-zero on an unhandled
  error with no failing case. Read the `Errors` line.
- **`pnpm format:check` is its own gate** — `pnpm check` and `turbo run lint` do
  not run Prettier, and CI does.
- **Turborepo replays greens it never ran**: `pnpm exec turbo run <task> --force`.
- **`pnpm e2e` leaves keys in Redis**: `redis-cli FLUSHALL` between it and
  `pnpm test`.
- **A pull request title becomes a squash commit's subject**, and the hook
  refuses one over 72 characters once ` (#NNN)` is added.
- **`Human review` is red on every pull request and always will be.** It is not a
  gate anybody is failing.

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
plans/README.md                          # where every track stands
plans/current-state/11-promotion-debt.md # before merging to main or staging
plans/product/15-daily-article.md        # the track that shipped last
plans/product/09-admin-role.md           # the grant, and why it is a human action
```

---
*Written by Claude Code, from a session that shipped two tracks and repaired a graph.*
