# Session handover — 2026-09-11

> Written in English, like everything else in this repository (`CLAUDE.md`).
>
> Replaces the handover of 2026-09-07, which described a pause after tracks C
> and E. Everything it listed as outstanding and still open is restated below.

## Context

**The product effort is finished.** Tracks F, G, H and I shipped overnight; this
session took track J from an unstarted checklist to eleven closed steps. What is
left in `plans/product/` is four things a person has to do, and none of them is
code.

## State at the pause

- **`staging`:** carries everything below. **`main` is 103 commits behind it**,
  and nothing of tracks C to J is in production.
- Working tree clean. Fourteen pull requests this session, #234 to #247, all
  merged to `staging`.
- **`plans/README.md` carries the state of every track.** Nothing else does.

## Read this before promoting: the migrations

**Nothing in the deploy path runs one.** `vercel.json` builds with `turbo run
build`, `apps/web`'s build is `next build`, Render deploys a container on a
commit to `main`, and neither workflow calls `pnpm migrate`. Checked rather than
assumed — `08-toolchain-debt.md` carries the finding, `method/01-git-flow.md`
the procedure.

**The production schema is nonetheless up to date**, and this paragraph replaces
one that said otherwise. `drizzle.__drizzle_migrations` holds all twenty-one
rows, applied **one at a time between 10 and 11 September** as each migration
was written; every table and column the batch adds exists. The earlier claim —
"fifteen migrations are pending" — was read off `git diff main..staging` over
the migration *files*, which says what `main` is missing and nothing at all
about a database. **Ask the database, not the branch:**

```sql
select count(*) from drizzle.__drizzle_migrations;   -- 21, and 21 .sql files
```

That is the lesson worth carrying: the schema is kept in step **by hand, by the
person who writes the migrations**, and it has been kept well. It works while
that is one person doing both jobs, and the register says what it costs the day
it is two.

Before applying anything new, `0007` is the one that can abort — it backfills
`profile.display_name_key`, then makes it `NOT NULL` **and `UNIQUE`**, so two
existing profiles folding to the same key take the whole migration with them:

```sql
select lower(regexp_replace(btrim(display_name), '\s+', ' ', 'g')) as key,
       count(*)
from profile group by 1 having count(*) > 1;
```

The order, when there *is* something to apply — code before schema is an outage,
schema before code is not:

```bash
DATABASE_URL='<production>' pnpm migrate     # drizzle applies only what is missing
gh pr create --base main --head staging --title 'Promote staging: tracks C to J'
git switch staging && git merge --ff-only origin/main && git push
```

## What shipped this session — track J, eleven steps

- **J.1** re-ran the audit and found three ✅ that were already false: the share
  image had shipped, and the mobile and accessibility rows named four routes
  while ten existed. It filed the two steps that became J.9 and J.10.
- **J.2** drew the mark — a question mark, because Wikipedia's own favicon is a
  W and this game reads their encyclopaedia without being endorsed by them. It
  found that Next passes `id` to an icon route as a *promise*: `/icon/192` was
  serving a 32×32 PNG with every unit test green.
- **J.3** wrote the privacy policy and the terms from the code rather than from
  a template, and found that the export was three tracks behind.
- **J.4 / J.4b** count arrivals — one row per day per page, **no identifier of
  any kind** — and show them in the panel's seventh section.
- **J.5** answers eleven questions and carries the site's only structured data.
- **J.6** labelled the one unlabelled `<svg>` and left a scan behind.
- **J.7** follows every link the site offers, in the journeys CI already runs.
- **J.8** gave the five other entry screens the budget the landing had.
- **J.9** decided the leaderboard is **not** indexed — a board publishes
  pseudonyms — and moved every indexing decision into one list with a test.
- **J.10** swept thirteen routes at 360 px, three of them behind an account.
- **J.11** caught the export up, and `EXPORT_COVERAGE` now fails when a new
  table is not decided about.

Two things came out of CI rather than out of a plan: the debt register split a
fifth way (`10-test-debt.md`) because `08-toolchain-debt.md` hit the 200-line
rule with a finding still to write, and the promotion procedure above.

## Outstanding

**Needs a person, not a session:**

- **Nothing**, for the schema: it is already up to date. The check above is
  what says so, and it is a query rather than a `git diff`.
- **E.1's credentials** — Google console, then two variables in Vercel.
  `plans/product/05-accounts-oauth.md` has the runbook and the preview trap.
- **`CRON_SECRET` in Vercel**, or track F's quests never rotate.
- **C.7's device measurement** — `plans/product/03-landing-budget.md`, steps 1–6.
- **A human reading of the legal text.** `/privacy` and `/terms` are accurate
  about the system, which is the part a repository can hold. Whether they are
  *sufficient* is a judgement no test makes, and it sits in the same queue as
  the French catalogue's review (`phase-11-i18n.md`).

**Inherited and still open:**

- **Step 10.10's dry run** — resume the suspended Render service, read
  `/api/health`, write the commit into `phase-10-rollback.md`, suspend.
- **Move the domain**, runbook step 5. The public domain still points at Render.
- **A rollback must recreate `DEPLOY_URL`.**
- **The Google AI key from the 2026-08-27 transcript**, if never regenerated.
- **The `rules.yml` concurrency defect**, and `Human review` failing on every
  pull request — the label it waits for was retired in #150. `gh` has no
  `workflow` scope, so neither can be fixed from a session.
- **Chat rail covers a card border at 360 px**; **`disabled:opacity-40`** is the
  one translucency the direction forbids.

## Read this before trusting a green

- **A green suite can still fail the job.** Read the `Errors` line under
  `Tests`: Vitest exits non-zero on an unhandled error with no failing case, and
  it happened twice this session — once from `better-auth`'s own timer, which
  nothing here can cancel. `10-test-debt.md`.
- **`pnpm test` races itself.** Three packages read `REDIS_URL` and turbo runs
  them at once; a realtime suite fails on a diff that touches no realtime code.
  Three times this session, green on every re-run.
- **The suites skip ~250 cases without Postgres and Redis** and still report
  success. A real run says `0 skipped`.
- **`pnpm format:check` is its own gate** — `pnpm check` and `turbo run lint` do
  not run Prettier, and CI does.
- **`pnpm e2e` leaves keys in Redis** and the next `pnpm test` fails on them:
  `redis-cli FLUSHALL` between the two.
- **A pull request title becomes a squash commit's subject**, and the hook
  refuses one over 72 characters once ` (#NNN)` is added.

## Commands to resume

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"   # nvm use is a no-op here
pnpm install && pnpm hooks

docker start wf-pg wf-redis
cp .env.example .env.local        # then fill in the Google key
pnpm migrate

pnpm exec turbo run typecheck lint test --force   # a real run says 0 skipped
pnpm e2e                                          # 111 browser journeys
pnpm format:check
```

Read first, in this order:

```
plans/README.md                     # where every track stands
plans/product/10-seo-and-legal.md   # the track that just closed, and its sheets
plans/method/01-git-flow.md         # the promotion, and the migrations before it
plans/current-state/10-test-debt.md # why a green run can be wrong
```

---
*Written by Claude Code, from a session that checked who runs the migrations.*
