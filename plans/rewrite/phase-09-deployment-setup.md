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
| Root directory | repository root (not `apps/web`) |
| Framework preset | Next.js |
| Node version | 22, from `.nvmrc` |
| Production branch | `main` |

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

## Realtime — Fly.io

`apps/realtime/fly.toml` and `apps/realtime/Dockerfile`. The service is a
long-lived Node process holding WebSocket connections, which is what rules
out a serverless host for it.

### Secrets

Set with `fly secrets set`, never in `fly.toml`:

`DATABASE_URL`, `REDIS_URL`, `GOOGLE_GENERATIVE_AI_API_KEY`,
`BETTER_AUTH_SECRET`, `SENTRY_DSN` (optional).

### Non-secret configuration

In `fly.toml` under `[env]`: `NODE_ENV`, `PORT`, `BETTER_AUTH_URL`,
`REALTIME_ALLOWED_ORIGINS`.

`REALTIME_ALLOWED_ORIGINS` is a comma-separated list. A Vercel preview gets
a new hostname per deployment, so a preview that must reach the deployed Fly
instance needs its origin added — or a separate Fly app for previews.

### The deployed commit

`FLY_GIT_COMMIT` is not injected by the platform. It is passed as a build
argument by the deploy workflow and baked into the image, which is what lets
`/api/health` answer the SHA the probe compares against.

## What is still Render

The public domain stays on Render until phase 10. `DEPLOY_URL` keeps
pointing there; `WEB_DEPLOY_URL` and `REALTIME_DEPLOY_URL` are the two new
variables the ported probe reads, and both skip cleanly when unset.

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
