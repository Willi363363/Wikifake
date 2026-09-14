# Session handover — 2026-09-14

> Written in English, like everything else here (`CLAUDE.md`). Replaces the
> handover of 2026-09-13; everything it left open is restated below.

## Context

Yesterday chose the panel's shapes the slow way — eleven rounds of three
candidates, built in the real stack rather than described — and stopped at K.1.
This session wrote them. **Track K is finished**: eight pages on the chosen
shapes, the period rebuilt, the lab deleted.

## State at the pause

- **Track K is on `staging`**: pull request #265 is merged, so pre-production
  carries the eight pages. `main` does not yet — the promotion is below.
- **Pull request #264 is what is left**, and it is this file's neighbour: the
  grant procedure in `09-admin-role.md`. It conflicted here because track K
  replaced the handover wholesale; the conflict is resolved on its own branch,
  towards this version, because the list below already puts the grant first.
- `plans/README.md` marks track K done. `plans/product/12-admin-pages.md`
  carries the step table, and **K.9b is the one row no commit can tick** — see
  *Outstanding*.
- `apps/web/src/dev/` and `/dev/admin` are gone, with the `/dev` prefix that
  kept crawlers out of them.

## The two decisions the track was waiting on

Both were put to the owner before a line was written, and both are recorded in
`12-admin-pages.md` beside the code that came out of them.

**The presets are calendar periods** — `24 h · this week · this month · this
year · all`. I.8 shipped rolling windows and the two are not the same question:
*this month* on the 2nd is two days of data and *30 days* never is. The cost is
that two periods are uneven, so the bar prints the days it covers, and
`range.test.ts` asserts the short month rather than regretting it. Weeks are
`periodWindowOf`'s weeks — Monday, UTC — so a panel's week and a quest's week
are one week. Months and years are computed in `range.ts`, because
`@wikifake/domain` forbids itself `new Date(`.

**The custom period is real.** A `GET` form with two native date inputs and a
hidden `range=custom`, submitting to the page it is on: the browser navigates,
the address is bookmarkable, and nothing calls a router or a server action. Both
ends count, a backwards pair cannot be applied, a future end is clamped to
today, and anything a hand-typed link can carry falls back to a month.

## What the pages gained that the mockups could not carry

- **The chassis names the open page.** The sections lost their `h2` when they
  became routes, and a document whose only heading is the product's name says
  nothing about where it is. `page-heading.tsx` reads `sections.ts`, so the rail
  and the heading cannot say different words.
- **A list of rows is a `<table>`.** The lab drew grids of `div`s because it was
  comparing arrangements. The roster, the articles, the days and the kinds are
  tables now, with the digest's look on top.
- **Each row of the cost table carries what it cost**, computed by `spendOf` in
  the reader. A screen multiplying tokens by a rate itself would be a second
  implementation of the only arithmetic this panel does, and a table whose rows
  did not add up to the total is the failure that looks like a bug in the data.
- **One figure was dropped rather than invented.** The Players mockup drew new
  accounts per day; `readPlayers` counts a cohort and does not bucket it, and
  the track's own rule is that a field with no reader is a field to drop.

## Two things this session had to fix to be green

- **`cost.test.ts`'s time bomb is defused.** Its `game` rows took the column
  default `now()` while the read window ended at `NOW + 1 day`, so from
  12 September the fixtures fell outside the window they were read through.
  Pinned to the test's clock, like every other fixture. Three cases.
- **`sections.test.ts` did not exist.** `sections.ts` has claimed since K.1 that
  a test held the rail and the routes to being one list. K.4 leaned on that
  claim — the heading now reads the section off the list — so the file was
  written rather than the comment softened.

## Outstanding

1. **Grant the panel to `admin.wikifake@gmail.com`** — still not done, and it
   is what stands between this work and anybody seeing it. The `admin` table is
   empty, so `/admin` answers 404 to everybody, the owner included.
   `plans/product/09-admin-role.md`, *"Nobody holds the grant yet"*, carries the
   order: **sign in through Google first**, because until the account exists the
   insert matches nothing and says so by inserting nothing. Then the insert and
   the read-back, in the Neon console. No redeploy: `isAdmin` is a lookup run on
   every page load. And it says why nothing on this disk can do it —
   `.env.local` describes the local containers, and production Postgres is Neon
   with its connection string in Vercel.
2. **Set the two cost rates in Vercel** — `MODEL_INPUT_COST_PER_MTOK=0.215` and
   `MODEL_OUTPUT_COST_PER_MTOK=1.29`. That is `gemini-3.1-flash-lite` at
   $0.25/$1.50 per million, converted at 0.861 USD→EUR on 13 September 2026 —
   **read the date before trusting the number**. Until both are set the cost
   page reports tokens and says why, which is the state it was designed for.
   `12-admin-pages.md` carries this as K.9b.
3. C.7's device measurement — `plans/product/03-landing-budget.md`, steps 1–6.
4. Read the French catalogue as a French reader (`phase-11-i18n.md`). Track K
   added about forty messages to `admin.json`, so there is more of it now.
5. Have `/privacy` and `/terms` read by somebody legal.

**The day a domain is bought**, in this order: remove it from Render first, add
it to Vercel, point the registrar at what Vercel asks for; add
`https://<domain>/api/auth/callback/google` to the Google console and change
`BETTER_AUTH_URL` and `NEXT_PUBLIC_SITE_URL`; set `NEXT_PUBLIC_REALTIME_URL`
and **redeploy**, since it is inlined at build time; add the origin to
`REALTIME_ALLOWED_ORIGINS` on Render; set `WEB_DEPLOY_URL` and
`REALTIME_DEPLOY_URL` in GitHub and delete `DEPLOY_URL` and
`STAGING_DEPLOY_URL`; open a throwaway pull request and confirm nothing stays
pending.

**The promotion is the next thing worth doing.** `staging` is thirty-six commits
ahead of `main`, and **no migration is outstanding in either direction** —
checked over `packages/db/migrations/`, not assumed — so it is a pure code merge
and step 1 of `01-git-flow.md`'s procedure is a no-op this time. Merged, never
squashed.

**Then, at leisure:** watch the arrivals section weekly; the chat rail covering
a card border at 360 px and the per-package Redis index (`10-test-debt.md`).

**Advertising stays deferred** — `11-deferred.md` carries the arithmetic, and
AdSense wants a domain somebody owns.

**Three a session cannot fix:** the `rules.yml` concurrency defect; `Human
review` failing on every pull request because the label it waits for was
retired in #150 and `gh` has no `workflow` scope; and a rollback needing
`DEPLOY_URL` recreated.

## Read this before trusting a green

- **The suites skip ~250 cases without Postgres and Redis** and still report
  success. A real run says `0 skipped`.
- **A green suite can still fail the job**: Vitest exits non-zero on an
  unhandled error with no failing case. Read the `Errors` line.
- **`pnpm format:check` is its own gate** — `pnpm check` and `turbo run lint`
  do not run Prettier, and CI does.
- **Turborepo replays greens it never ran**: `pnpm exec turbo run <task>
  --force`.
- **`pnpm e2e` leaves keys in Redis**: `redis-cli FLUSHALL` between it and
  `pnpm test`.
- **A pull request title becomes a squash commit's subject**, and the hook
  refuses one over 72 characters once ` (#NNN)` is added.
- **`Human review` is red on every pull request and always will be** until
  somebody with a `workflow` token edits `.github/workflows/rules.yml`. It is
  not a gate anybody is failing.

## Commands to resume

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"   # nvm use is a no-op here
pnpm install && pnpm hooks

docker start wf-pg wf-redis
pnpm migrate

pnpm exec turbo run typecheck lint test --force   # a real run says 0 skipped
pnpm format:check
pnpm --filter @wikifake/web build                 # the panel is eight routes now
```

Read first, in this order:

```
plans/README.md                   # where every track stands
plans/product/12-admin-pages.md   # the track this session finished
plans/product/09-admin-role.md    # the grant, and why it is a human action
plans/method/01-git-flow.md       # the promotion, and the migrations before it
```

---
*Written by Claude Code, from a session that coded the mockups it had been handed.*
