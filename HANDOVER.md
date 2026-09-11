# Session handover — 2026-09-11

> Written in English, like everything else in this repository (`CLAUDE.md`).
>
> Replaces the handover of 2026-09-07, which described a pause after tracks C
> and E. Everything it listed as outstanding and still open is restated below.

## Context

**The product effort is finished.** Tracks F, G, H and I shipped overnight; this
session took track J from an unstarted checklist to eleven closed steps. What is
left is a numbered list of gestures in a dashboard, and none of it is code.

## State at the pause

- **Tracks C to J are in production.** The promotion merged 108 commits into
  `main` and every route was probed by hand; `staging` is two documentation
  commits ahead of it.
- Working tree clean. Twenty-two pull requests this session, #234 to #255.
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

## Outstanding — the order to do it in

Everything below needs a person, and nothing below needs code except item 17,
which is optional.

**Today, about ninety minutes, all of it in a dashboard:**

1. Remove the custom domain from Render; add it to the Vercel project; wait for
   the certificate. Both providers claiming it is a certificate error.
2. Vercel production: `NEXT_PUBLIC_REALTIME_URL` = `wss://…`, then **redeploy**
   — it is inlined at build time, so a variable change alone does nothing.
3. Render, the realtime service: add the public origin to
   `REALTIME_ALLOWED_ORIGINS`. An origin it does not name is refused before the
   upgrade, which fails closed and invisibly.
4. GitHub → Settings → Variables: `WEB_DEPLOY_URL` = the public domain,
   `REALTIME_DEPLOY_URL` = Render, **delete** `DEPLOY_URL` and
   `STAGING_DEPLOY_URL`.
5. Google Cloud → Credentials → OAuth client ID, *Web application*. Redirect
   URIs: `https://<domain>/api/auth/callback/google` and the localhost one.
   Never a preview host — Google matches exactly, Vercel generates those.
6. The consent screen: External, then **Publish**. It asks for a privacy policy
   and terms, which track J shipped.
7. Vercel production: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
   `BETTER_AUTH_URL` = the public domain, `CRON_SECRET` = anything random.
   Redeploy. `BETTER_AUTH_URL` unset defaults to localhost and takes the
   callback, the realtime origins and the canonical URL down with it.
8. Sign in with Google **from a phone** — E.1's exit line.
9. Regenerate `GOOGLE_GENERATIVE_AI_API_KEY`, in a 2026-08-27 transcript.

**This week:**

10. Step 10.10's dry run: resume the Render service, read `/api/health`, write
    the commit into `phase-10-rollback.md`, suspend again.
11. C.7's device measurement — `plans/product/03-landing-budget.md`, steps 1–6.
    Track C closes with it.
12. Open a throwaway pull request towards `staging` and confirm nothing stays
    pending: the only way to learn a variable name was typed wrong.
13. Promote the documentation commits — merged, and **never squashed**.
14. Read the French catalogue as a French reader (`phase-11-i18n.md`).
15. Have `/privacy` and `/terms` read by somebody legal. They are accurate about
    the system; whether they are sufficient is a judgement no test makes.

**Then, at leisure:**

16. Watch the panel's arrivals section once a week. It is what says whether
    there is traffic, and nothing else does.
17. The remaining debt, if the mood takes you: the chat rail covering a card
    border at 360 px, `disabled:opacity-40`, `border-l-3` emitting no rule, the
    per-package Redis index (`10-test-debt.md`).

**Advertising — not yet, and a decision rather than an omission.**
`11-deferred.md` carries the arithmetic: €1–3 per thousand impressions needs
traffic in the hundreds of thousands to mean anything. When it does, in order:
apply to AdSense, add a Google-certified consent platform and therefore the
cookie banner this site does not have, add `ads.txt`, **rewrite the "Cookies"
and "Who else the data passes through" paragraphs in both catalogues** — they
currently promise there is no advertising — and give the panel a revenue
section.

**Three that a session cannot fix:** the `rules.yml` concurrency defect;
`Human review` failing on every pull request, because the label it waits for was
retired in #150 and `gh` has no `workflow` scope; and a rollback needing
`DEPLOY_URL` recreated.

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
