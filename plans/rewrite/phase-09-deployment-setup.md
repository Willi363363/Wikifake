# Phase 9 — Deployment setup

Repository-side configuration for the two target hosts. What lives here is
what a clone gets; what lives in a dashboard is listed so the two can be
compared.

## Web — Vercel

`vercel.json` at the repository root. Vercel detects the monorepo, but the
build has to go through Turborepo rather than a bare `next build`: the web
app depends on six workspace packages, and a build that does not resolve
them fails on the first import.

```json
{
  "buildCommand": "pnpm turbo run build --filter=@wikifake/web",
  "installCommand": "pnpm install --frozen-lockfile --ignore-scripts",
  "outputDirectory": "apps/web/.next"
}
```

`--ignore-scripts` matches CI: `@sentry/cli` downloads a binary at install
time and nothing in the web build needs it.

### Project settings

| Setting | Value |
|---|---|
| Root directory | **`apps/web`** |
| Framework preset | Next.js |
| Node version | 22.x, matching `.nvmrc` |
| Production branch | `main` |

**Root directory is `apps/web`, and this table used to say the repository
root.** That was written before any deployment existed, and it does not work:
Vercel looks for `next` in the `package.json` of the root directory, finds a
monorepo root that does not depend on Next, and refuses with "No Next.js
version detected" before the build starts. `framework: "nextjs"` in
`vercel.json` does not substitute for the detection.

`vercel.json` is still read from the repository root, and its `buildCommand`
and `installCommand` still run there — `pnpm turbo run build` needs the whole
workspace. Only `outputDirectory` is resolved **against the root directory**,
which is why it is `.next` and not `apps/web/.next`; the latter had Vercel
looking in `apps/web/apps/web/.next`.

The Node version is set explicitly rather than left to the platform default,
which was 24.x. Nothing is known to break on 24, but CI and `.nvmrc` say 22,
and a build validated on one runtime and shipped on another is a difference
nobody would think to look at.

`github.silent` is on: Vercel does not comment on every PR. The preview URL
is on the deployment status instead, which is where the probe reads it.

### Environment variables

Set for **Production**, **Preview** and **Development** unless noted.

| Variable | Note |
|---|---|
| `DATABASE_URL` | Postgres. A preview branch may point at the same database. |
| `REDIS_URL` | Article cache and room state. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Generation. Never in the repository. |
| `BETTER_AUTH_SECRET` | ≥ 32 characters, distinct per environment. |
| `BETTER_AUTH_URL` | The deployment's own origin. |
| `NEXT_PUBLIC_REALTIME_URL` | The Fly service, `wss://…`. |
| `SENTRY_DSN` | Optional. Absent → no reporting, which is correct locally. |
| `MODEL_NAME` | Optional, defaults to `gemini-3.1-flash-lite`. |
| `NEXT_PUBLIC_SITE_URL` | **Production only.** The public origin, for the canonical link and the sitemap of step 10.0. Left unset on a preview, `siteOrigin()` falls back to Vercel's own URL, which is what a preview should say about itself. Set on production, or the canonical points at whatever host answered. |

`VERCEL_GIT_COMMIT_SHA` is injected by the platform and read by
`deployedCommit()`: nothing to set.

### Preview protection

Vercel's deployment protection answers 401 to an unauthenticated probe. The
`deploy-check` workflow and the Playwright run therefore need either
protection off for previews, or a bypass token in
`VERCEL_AUTOMATION_BYPASS_SECRET`, passed as the
`x-vercel-protection-bypass` header.

## Realtime — Render's free tier

`render.yaml` at the repository root, plus `apps/realtime/Dockerfile`. The
service is a long-lived Node process holding WebSocket connections, which rules
out a serverless host for it.

**Fly.io was the original target and is abandoned: it requires a payment card
this project does not have.** Render's free web services support WebSockets, and
the detail that makes it workable is that WebSocket messages count as inbound
traffic — a room being played in does not let the service sleep.

### Blueprint, not dashboard

`render.yaml` declares both the web service and a free Key Value instance, so the
shape is reviewable in a diff. Everything non-secret is in it: `NODE_ENV`, `PORT`,
`BETTER_AUTH_URL`, `REALTIME_ALLOWED_ORIGINS`, `REALTIME_GRACE_SECONDS`; and
`REDIS_URL` is wired from the Key Value service by `fromService`.

`REALTIME_ALLOWED_ORIGINS` is comma-separated. A Vercel preview gets a new
hostname per deployment, so a preview that must reach this instance needs its
origin added.

### Secrets

Four, marked `sync: false` so Render asks once and they never enter git:
`DATABASE_URL`, `GOOGLE_GENERATIVE_AI_API_KEY`, `BETTER_AUTH_SECRET`,
`SENTRY_DSN` (optional). **`BETTER_AUTH_SECRET` must be the same value the web
app holds**, or a session minted by one service is refused by the other.

### The deployed commit

Render injects `RENDER_GIT_COMMIT` itself, so the build argument Fly needed is
gone — and `deployedCommit` names it first. It did not name it at all before
this step, which would have made `/api/health` answer an empty string while
every other field looked right, and `deploy-check` wait for a match that could
not come.

`initSentry` had the same bug from the other side: it resolved the release only
when `FLY_APP_NAME` was present, so on Render every error would have been
reported untagged. `apps/realtime/src/sentry.test.ts` now holds both shut.

### What the free tier costs

Three prices, none of them hidden:

- **It sleeps.** Fifteen minutes without inbound traffic, then about a minute to
  come back. There is no socket heartbeat, so a room idle in a lobby drops its
  sockets — and the domain allows a room to be idle for `ROOM_IDLE_LIMIT_SECONDS`
  (one hour). `REALTIME_GRACE_SECONDS = 90` is what keeps those seats: longer
  than the cold start, so a reconnection still finds its seat. The client already
  retries every second, indefinitely, with the same token.
- **No persistence on the free Key Value instance.** Round timers are BullMQ
  delayed jobs precisely so a redeployment would not forget a round in flight,
  and on this plan it does. Recorded in `../current-state/05-known-debt.md`.
- **750 instance hours a month, per workspace.** Always-on for thirty days is
  720, so it fits with no room for a second free service.

### Why not the Upstash instance the web app uses

Upstash's free plan meters 500,000 commands a month, and BullMQ polls Redis
continuously even when idle — Upstash's own BullMQ page says to move to a fixed
plan for this workload. A metered Redis behind a polling queue is a free tier
that expires in days. Render's Key Value bills no commands, hence its own.

### Deployment

Render's own, from git: `autoDeploy: true` on `main`. `deploy-realtime.yml` and
its `FLY_API_TOKEN` are deleted — a second way to deploy is a way to disagree.

## What is still Render, from before

The public domain stays on the old Render service until the cutover completes.
`DEPLOY_URL` keeps pointing there; `WEB_DEPLOY_URL` and `REALTIME_DEPLOY_URL`
are the variables the ported probe reads, both skipping cleanly when unset. Free
instance hours are per **workspace**, so the old service shares the budget.

## The probe

`deploy-check.yml` runs `scripts/probe-deploy.sh` once per target. The
variables it reads, all optional:

| Variable | Target |
|---|---|
| `DEPLOY_URL` / `STAGING_DEPLOY_URL` | Render, until phase 10 |
| `WEB_DEPLOY_URL` / `WEB_STAGING_DEPLOY_URL` | Vercel |
| `REALTIME_DEPLOY_URL` / `REALTIME_STAGING_DEPLOY_URL` | Fly.io |

Plus one secret, `VERCEL_AUTOMATION_BYPASS_SECRET`, sent as
`x-vercel-protection-bypass`.

To verify by hand, from the Actions tab: run the workflow with `url` set to
a preview and `expected_sha` to the commit it should serve. The same run
with a different SHA fails, which is the half that proves the loop is
comparing anything at all.

## What is actually provisioned

Recorded because this sheet was written before anything existed, and half of
it was wrong until a deployment proved so.

| | |
|---|---|
| Vercel project | `wikifake`, scope `willi363`, Hobby |
| Production | `https://wikifake.vercel.app` |
| Postgres | Neon `neon-aqua-castle`, via the marketplace — 14 tables migrated |
| Redis | Upstash `upstash-kv-carmine-leaf`, via the marketplace |
| Git link | `Willi363363/Wikifake`, so every push gets a preview |
| Realtime | **not deployed.** Fly.io is step 9.8, and multiplayer does not work until it is |

The two marketplace integrations set `DATABASE_URL` and `REDIS_URL` on all
three environments themselves; neither was pasted by hand. `BETTER_AUTH_URL`
and `NEXT_PUBLIC_SITE_URL` are production-only and both name the production
domain — a preview leaves them unset, so `siteOrigin()` falls back to Vercel's
own URL, which is what a preview should say about itself.

Verified against the running deployment rather than in a test: `commit` in
`/api/health` equals the pushed SHA, `GET /` answers titled HTML 200, and a
real solo round starts, scores and reveals its solution — with no explanation,
hint or position in the start payload.
