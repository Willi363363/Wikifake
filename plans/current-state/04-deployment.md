# Current state — deployment

Four providers, and the split is not an accident: **Vercel does not host
long-lived WebSockets.** A serverless function frozen between invocations
cannot hold a socket open, so every room in flight would die with it. That one
fact is why there are two applications and two hosts.

| Runs | Where | Config |
|---|---|---|
| `apps/web` | Vercel | `vercel.json` |
| `apps/realtime` | Fly.io | `apps/realtime/fly.toml` + its `Dockerfile` |
| Postgres | Neon | `DATABASE_URL` |
| Redis | Upstash | `REDIS_URL` |

## The web app on Vercel

`vercel.json` builds through Turborepo from the repository root — the app
depends on eight workspace packages, and a build rooted at `apps/web` cannot
see them:

```json
"buildCommand": "pnpm turbo run build --filter=@wikifake/web",
"installCommand": "pnpm install --frozen-lockfile --ignore-scripts"
```

`--ignore-scripts` is deliberate: `@sentry/cli` downloads a binary at install
time and nothing in the build needs it. `pnpm-workspace.yaml`'s `allowBuilds`
holds the exception for the day a sourcemap upload does.

Every pull request gets a preview URL. The variables a deployment needs are
listed in `../rewrite/phase-09-deployment-setup.md`; the one worth naming here
is `NEXT_PUBLIC_SITE_URL`, **production only**, because without it the canonical
link and the sitemap name whichever host answered rather than the public
domain.

## The socket service on Fly

A long-lived Node process, deployed from CI by `deploy-realtime.yml` and never
by hand. Three decisions in `fly.toml` are load-bearing:

- **`auto_stop_machines = false`.** A stopped machine drops every socket it was
  holding, and the players on them do not come back because a health check woke
  it up later.
- **The platform health check is `/ping`, not `/api/health`.** The platform asks
  whether the process answers; a probe that read the database would report the
  service down when only the database is. `/api/health` is for the CI probe,
  which is asking a different question.
- **`FLY_GIT_COMMIT` is a build argument, not a platform variable.** Fly injects
  no commit of its own, unlike Vercel's `VERCEL_GIT_COMMIT_SHA`. The deploy
  workflow bakes it into the image; an image that baked none would answer an
  empty string, and the probe below would wait for a match that cannot come.

Secrets — `DATABASE_URL`, `REDIS_URL`, the model key, `BETTER_AUTH_SECRET`,
`SENTRY_DSN` — are set once with `fly secrets set` and never live in the file.

## Knowing which commit is serving

Both services answer the same shape at the same path:

```json
{
  "status": "ok", "version": "1.1.0", "commit": "5d9d884…",
  "commitShort": "5d9d884", "model": "gemini-3.1-flash-lite",
  "llmConfigured": true
}
```

`commit` is a string **present even when empty** — locally there is no platform
to provide one. Optional would let the probe read `undefined` and wait for ever,
which is what C7.2 exists to prevent. There is no field for the API key:
`llmConfigured` says whether generation can work, and the key itself has
nowhere to go, so there is nothing to leak. A test asserts it does not appear in
the serialised JSON.

## The `deploy-check` probe

`deploy-check.yml` polls the health route after a push and waits until the
served commit is the one that was pushed. This is what replaces the round trip
to a dashboard: before it, the repository published no commit status, no
deployment, no environment.

`scripts/probe-deploy.sh` does the polling, and it distinguishes three
outcomes — the right SHA, a different SHA, and nothing answering — because
"the deploy is late" and "the deploy is wrong" need different advice.

Each target is a repository variable, and each job **skips itself cleanly**
when its variable is unset, so a fork never sees its CI fail on a URL it has no
reason to hold:

| Variable | Target |
|---|---|
| `WEB_DEPLOY_URL` / `WEB_STAGING_DEPLOY_URL` | Vercel |
| `REALTIME_DEPLOY_URL` / `REALTIME_STAGING_DEPLOY_URL` | Fly.io |
| `DEPLOY_URL` / `STAGING_DEPLOY_URL` | Render, until step 10.11 |

> **Settings → Secrets and variables → Actions → Variables → New**

Vercel's preview protection can answer 401 to the probe and to the browser
journeys; `VERCEL_AUTOMATION_BYPASS_SECRET` is the way past it.

## Still Render, for now

The public domain is still served by Render, from the image it built before the
Python left the repository at step 10.9. Step 10.11 repoints the domain, updates
the probe variables and **suspends** — not deletes — the service, so the
rollback of `../rewrite/phase-10-rollback.md` has something to wake up. Until
then `DEPLOY_URL` keeps probing it, and its `autoDeploy` must be turned off
before the merge that removes the `Dockerfile` it builds from.

## CI

`ci.yml` runs `lint`, `typecheck`, `test`, `build` and the browser journeys, on
pnpm with the Turborepo cache, with Postgres and Redis as services so nothing
skips. `rules.yml` carries the pull-request checks: conformance, secret scan,
human review.

The `guard` job is not decorative. A branch with an open PR to `main` triggers
both a `push` and a `pull_request` run for the same commit; `guard` deduplicates
them. Removing it "to simplify" leaves a phase PR towards the umbrella with no
checks at all — a `fix(ci)` patch has already been paid to learn that.
