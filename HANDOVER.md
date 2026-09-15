# Session handover — 2026-09-15

> Written in English, like everything else here (`CLAUDE.md`). Replaces the
> handover of 2026-09-14; everything it left open is restated below.

## Context

The handover this replaces was written the morning of 14 September and never
updated. **Two things happened after it and neither left a record**: track L was
designed and shipped in a day, and the promotion that carried it broke the
branch graph in a way that took five pull requests to repair. Both are below,
and the second is the one to read first if you are about to merge anything.

## State at the pause

- **`main` carries everything.** Promotion #281 merged with a **merge commit**,
  and all three workflows are green on it — `rules`, `Deploy check`, `CI`.
- **`staging` is two commits ahead of `main`**, both documentation (#282),
  and it is an ancestor of `main` again. The graph is healthy.
- **Every track is done**, A through L. `plans/README.md` carries the table and
  is the only place that says so.
- No pull request is open.

**Check this before opening a promotion**, because it is what went wrong:

```bash
git merge-base --is-ancestor origin/main origin/staging || echo 'realign first'
```

## Track L — the interface, again

Not in any plan the morning it started. Two complaints from the owner on
14 September, and they are not the same complaint: the art direction of track A
was *"trop IA-like"*, and **there was no global navigation in this repository at
all** — not a bar, not a menu, not a footer of links. The shop and the quests
were three clicks away through prose, and `/admin` was reachable only by typing
the URL.

L.1 to L.9 are all done and `13-ui-overhaul.md` carries the decisions beside the
code. What matters to somebody arriving now:

- **The direction is J2**, chosen the way track A's was — candidates built in
  the real stack, on real copy from the catalogue, looked at on a phone. Four
  rounds were refused first, and the reason is in the file: they changed the
  palette three times and kept one skeleton, and the skeleton was the cliché.
- **The navigation exists**, and every route is one click away.
- **`/admin` still announces itself to nobody.** The button is rendered on the
  server only for an account the `admin` table names, so a non-admin receives
  nothing rather than a hidden element.
- **L.9 was not in the plan, and that is the finding.** L.3 wrote twenty-two
  dark tokens and measured twenty-one pairs across them, and nothing outside
  `/gallery` ever applied `.dark` — the whole second palette shipped where no
  player could see it, and track A had the same gap for eight months. Found by
  reading the built page. **No test asks whether a stylesheet is reachable.**

## The merge method, which cost five pull requests

Read `plans/current-state/11-promotion-debt.md` before merging anything to
`main` or `staging`. The short version:

| | PR | Method | Result |
|---|---|---|---|
| the promotion | #271 | squash | `main` stops descending from `staging` |
| realign 1–3 | #273, #276, #279 | squash | three empty commits, graph unrepaired |
| realign 4 | #280 | **merge, from the CLI** | repaired |

Every one of those carried the right method in its own title, in bold, above its
own diff. **A title cannot stop a button.** GitHub remembers the last merge
method used per repository, and squash is the *right* method for every other
branch here — so the default drifts back by itself, days apart, to the two cases
where it is wrong.

A realign is the worst of them: its diff is empty by construction, so squashing
it keeps the nothing, discards the second parent that was the whole payload, and
**still reports success**.

**Until the setting is changed, merge both merge-commit rows from the command
line:**

```bash
gh pr merge <n> --merge --delete-branch --admin
```

## Outstanding

**The first three are the owner's and nothing in this repository can do them.**

1. **Change the merge-method setting** — `Settings → General → Pull Requests`:
   merge commits only, or squash disallowed where the base is `main` or
   `staging`. `.claude/settings.json` denies an agent the ruleset and the
   `gh api` write verbs, deliberately. Until it is changed, every promotion and
   every realign is one click away from repeating the five above.
2. **Grant the panel to `admin.wikifake@gmail.com`** — still not done, and it is
   what stands between the admin work and anybody seeing it. The `admin` table
   is empty, so `/admin` answers 404 to everybody, the owner included.
   `plans/product/09-admin-role.md` carries the order: **sign in through Google
   first**, because until the account exists the insert matches nothing and says
   so by inserting nothing. Then the insert and the read-back, in the Neon
   console. No redeploy — `isAdmin` is a lookup run on every page load. Nothing
   on this disk can do it: `.env.local` describes the local containers, and
   production Postgres is Neon with its connection string in Vercel.
3. **Set the two cost rates in Vercel** — `MODEL_INPUT_COST_PER_MTOK=0.215` and
   `MODEL_OUTPUT_COST_PER_MTOK=1.29`. That is `gemini-3.1-flash-lite` at
   $0.25/$1.50 per million, converted at 0.861 USD→EUR **on 13 September 2026 —
   read the date before trusting the number**. Until both are set the cost page
   reports tokens and says why, which is the state it was designed for. K.9b in
   `12-admin-pages.md`.

**Then:**

4. C.7's device measurement — `plans/product/03-landing-budget.md`, steps 1–6.
5. Read the French catalogue as a French reader (`phase-11-i18n.md`). Track K
   added about forty messages to `admin.json` and track L added more.
6. Have `/privacy` and `/terms` read by somebody legal.
7. At leisure: the chat rail covering a card border at 360 px, and the
   per-package Redis index (`10-test-debt.md`).

**The day a domain is bought**, in this order: remove it from Render first, add
it to Vercel, point the registrar at what Vercel asks for; add
`https://<domain>/api/auth/callback/google` to the Google console and change
`BETTER_AUTH_URL` and `NEXT_PUBLIC_SITE_URL`; set `NEXT_PUBLIC_REALTIME_URL`
and **redeploy**, since it is inlined at build time; add the origin to
`REALTIME_ALLOWED_ORIGINS` on Render; set `WEB_DEPLOY_URL` and
`REALTIME_DEPLOY_URL` in GitHub and delete `DEPLOY_URL` and
`STAGING_DEPLOY_URL`; open a throwaway pull request and confirm nothing stays
pending.

**Advertising stays deferred** — `11-deferred.md` carries the arithmetic, and
AdSense wants a domain somebody owns.

**Three a session cannot fix:** the `rules.yml` concurrency defect; `Human
review` failing on every pull request because the label it waits for was retired
in #150 and `gh` has no `workflow` scope; and a rollback needing `DEPLOY_URL`
recreated.

## Read this before trusting a green

- **The suites skip ~250 cases without Postgres and Redis** and still report
  success. A real run says `0 skipped`.
- **A green suite can still fail the job**: Vitest exits non-zero on an
  unhandled error with no failing case. Read the `Errors` line.
- **`pnpm format:check` is its own gate** — `pnpm check` and `turbo run lint` do
  not run Prettier, and CI does.
- **Turborepo replays greens it never ran**: `pnpm exec turbo run <task> --force`.
- **`pnpm e2e` leaves keys in Redis**: `redis-cli FLUSHALL` between it and
  `pnpm test`.
- **A pull request title becomes a squash commit's subject**, and the hook
  refuses one over 72 characters once ` (#NNN)` is added.
- **`Human review` is red on every pull request and always will be.** It is not
  a gate anybody is failing.

## Commands to resume

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"   # nvm use is a no-op here
pnpm install && pnpm hooks

docker start wf-pg wf-redis
pnpm migrate

pnpm exec turbo run typecheck lint test --force   # a real run says 0 skipped
pnpm format:check
pnpm --filter @wikifake/web build
```

Read first, in this order:

```
plans/README.md                          # where every track stands
plans/current-state/11-promotion-debt.md # before merging to main or staging
plans/product/13-ui-overhaul.md          # the track that shipped last
plans/product/09-admin-role.md           # the grant, and why it is a human action
```

---
*Written by Claude Code, from a session that spent itself repairing a graph.*
