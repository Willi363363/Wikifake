# Current state — deployment

## The Docker image

Multi-stage Docker image (`Dockerfile`): the frontend is built in a Node
stage, then copied into the Python image at `frontend/dist`, which
`static_files.py` serves. Render injects `$PORT`.

```bash
docker build -t wikifake .
docker run -p 8000:8000 -e GEMINI_API_KEY=... wikifake
```

## Knowing whether production is up to date

`GET /api/health` answers **which version is running**:

```json
{"status":"ok","version":"1.1.0","commit":"5d9d884…","model":"gemini-3.1-flash-lite","llm_configured":true}
```

`commit` comes from `RENDER_GIT_COMMIT`, injected by the platform; it is
empty locally, which is normal.

## The `deploy-check` probe

The `deploy-check.yml` workflow polls this route after every push to `main`
and waits until the served commit is the one that was just pushed. This is
what replaces the manual round trip to the Render dashboard — the repository
previously published no commit status, no deployment, no environment.

It has to be given the URL, once:

> **Settings → Secrets and variables → Actions → Variables → New**
> `DEPLOY_URL` = `https://<service>.onrender.com`

Without this variable, the job skips itself cleanly and explains how to
configure it: a fork will never see its CI fail because of this.

## `render.yaml`

`render.yaml` versions the service configuration (Dockerfile, branch,
automatic deployment, `healthCheckPath`). **It only has an effect if the
service is attached to a Blueprint** — as long as the service is configured
by hand in the dashboard, this file documents the expected configuration
without applying it. The API keys are marked `sync: false` there: they stay
in the dashboard.
