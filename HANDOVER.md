# Session handover — 2026-09-13

> Written in English, like everything else here (`CLAUDE.md`). Replaces the
> handover of 2026-09-11; everything it left open is restated below.

## Context

The product effort was finished and the panel was the thing nobody liked: seven
sections on one page. This session designed its replacement the slow way —
eleven rounds of three candidates each, built in the real stack rather than
described — and started integrating the result.

**Everything is on `feat/dev-rail-lab`, pull request #265, open against
`staging`.** Nothing is merged yet.

## State at the pause

- **The choices are made, and they are recorded in two places**: the table at
  the top of `plans/product/12-admin-pages.md`, and the working code they came
  from in `apps/web/src/dev/`. Both are pushed.
- **K.1 is done.** The panel is eight routes. The seven sections keep the body
  track I gave them; the chosen shapes arrive in K.3 to K.10.
- Working tree clean apart from `apps/web/AGENTS.md` and `apps/web/CLAUDE.md`,
  which `next dev` regenerates and which nobody has ever committed.

## What was chosen

| Page | Chosen |
|---|---|
| The rail | Boxed groups — Audience, The game, System |
| Overview | Digest |
| Players | Digest |
| Activation | Funnel |
| Arrivals | Digest **plus** the one-step funnel from the candidate beside it |
| Rounds | Two modes |
| Content | Digest |
| Cost | Digest |
| Health | Status board |

## The lab, and why it is still there

`/dev/admin` holds every candidate, working, switchable, on the real tokens.
It is scratch and K.12 deletes it — **do not delete it before K.10**, because
each page step lifts its component from `src/dev/` and the two have to be
compared side by side while that happens.

It is ungated on purpose: it reads nothing and renders a constant. `/dev` is a
prefix in `CRAWLERS_KEPT_OUT`, so nothing under it is crawled.

## Two things it taught, the hard way

**A layout that needs JavaScript is unreadable when JavaScript is what broke.**
The lab was dead on a phone — not slow, dead, every button inert — because the
dev server's HMR socket cannot complete its handshake when the page is reached
on anything but `localhost`, so hydration never finished. The first fix made
the layout depend on `matchMedia` in an effect, which is exactly the thing that
had broken. The narrow layout is CSS now, and K.1's rail was built that way
from the start.

**To look at anything from a phone, build it.** `next dev` over a LAN address
does not hydrate. `pnpm --filter @wikifake/web build` then
`pnpm --filter @wikifake/web exec next start -H 0.0.0.0`, and reach it on the
machine's LAN address — this laptop tethers to a phone, so it is
`172.20.10.7:3000`, with `100.77.153.4` over Tailscale as the fallback.

## Next session: the plan is written

`plans/product/12-admin-pages.md` carries it, step by step, with the lab file
each one lifts from and the four moves each one is made of. Start at **K.2**,
which is the step the other eight lean on.

**K.2 has a decision in it that nobody has taken yet.** The presets asked for
are calendar periods — *this week*, *this month*, *this year* — and `range.ts`
is rolling: 7, 30, 90 days. "This month" on the 2nd is two days of data, and
"30 days" never is. They are different questions and the answer changes
`rangeFrom`, `PRESETS` and `range.test.ts`. Ask before writing.

The custom-range dialog in the lab is a mockup: its two dates are fixed and
Apply selects one hard-coded range. K.2 either makes it real or cuts it.

## Outstanding, and none of it is code

Unchanged from the last handover except where marked.

1. **Grant the panel to `admin.wikifake@gmail.com`** — still not done. The
   `admin` table is empty, so `/admin` answers 404 to everybody. Two statements
   in the Neon console; `plans/product/09-admin-role.md` carries them and says
   why `.env.local` cannot do it.
2. C.7's device measurement — `plans/product/03-landing-budget.md`, steps 1–6.
3. Read the French catalogue as a French reader (`phase-11-i18n.md`).
4. Have `/privacy` and `/terms` read by somebody legal.
5. **Set the two cost rates in Vercel** — new, and K.9 wants them:
   `MODEL_INPUT_COST_PER_MTOK=0.215` and `MODEL_OUTPUT_COST_PER_MTOK=1.29`.
   That is `gemini-3.1-flash-lite` at $0.25/$1.50 per million, converted at
   0.861 USD→EUR on 13 September 2026. No rate belongs in the repository.

**The day a domain is bought**, in this order: remove it from Render first, add
it to Vercel, point the registrar at what Vercel asks for; add
`https://<domain>/api/auth/callback/google` to the Google console and change
`BETTER_AUTH_URL` and `NEXT_PUBLIC_SITE_URL`; set `NEXT_PUBLIC_REALTIME_URL`
and **redeploy**, since it is inlined at build time; add the origin to
`REALTIME_ALLOWED_ORIGINS` on Render; set `WEB_DEPLOY_URL` and
`REALTIME_DEPLOY_URL` in GitHub and delete `DEPLOY_URL` and
`STAGING_DEPLOY_URL`; open a throwaway pull request and confirm nothing stays
pending.

**Then, at leisure:** promote `staging` to `main` — merged, never squashed;
watch the arrivals section weekly; the chat rail covering a card border at
360 px and the per-package Redis index (`10-test-debt.md`).

**Advertising stays deferred** — `11-deferred.md` carries the arithmetic, and
AdSense wants a domain somebody owns.

**Three a session cannot fix:** the `rules.yml` concurrency defect; `Human
review` failing on every pull request because the label it waits for was
retired in #150 and `gh` has no `workflow` scope; and a rollback needing
`DEPLOY_URL` recreated.

## Read this before trusting a green

- **`src/admin/cost.test.ts` fails three cases, and it is not your diff.**
  `NOW` is pinned to 11 September 2026 and the read window ends at `NOW + 1
  day`; the `llm_call` fixtures pin their own `createdAt` but the `game` and
  `participant` rows take the column default, which is `now()`. From **12
  September 2026, 12:00 UTC** every game the test inserts falls outside the
  window it then reads. A time bomb that went off on its own, recorded rather
  than fixed — it wants its own branch.
- **The suites skip ~250 cases without Postgres and Redis** and still report
  success. A real run says `0 skipped`.
- **A green suite can still fail the job**: Vitest exits non-zero on an
  unhandled error with no failing case. Read the `Errors` line.
- **`pnpm format:check` is its own gate** — `pnpm check` and `turbo run lint`
  do not run Prettier, and CI does.
- **`pnpm e2e` leaves keys in Redis**: `redis-cli FLUSHALL` between it and
  `pnpm test`.
- **A pull request title becomes a squash commit's subject**, and the hook
  refuses one over 72 characters once ` (#NNN)` is added.

## Commands to resume

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"   # nvm use is a no-op here
pnpm install && pnpm hooks

docker start wf-pg wf-redis
pnpm migrate

pnpm exec turbo run typecheck lint test --force   # a real run says 0 skipped
pnpm format:check
```

Read first, in this order:

```
plans/product/12-admin-pages.md   # the track under way, and the plan
plans/README.md                   # where every track stands
plans/method/01-git-flow.md       # the promotion, and the migrations before it
plans/current-state/10-test-debt.md
```

---
*Written by Claude Code, from a session that built the candidates instead of describing them.*
