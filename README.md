# WikiFake

A misinformation-detection game. The server fetches a Wikipedia article, a
language model injects factual errors into it, and players have to find
them — alone or together, sabotaging each other with items.

The principle that structures everything else: **the server is the only
authority, and the solution never leaves it before the end of the round.**

## Getting started

A TypeScript monorepo — pnpm workspaces and Turborepo. No Python: the old
stack was deleted at the cutover of phase 10.

```bash
nvm use                 # Node 22, pinned by .nvmrc
corepack enable pnpm    # if needed: npm i -g corepack@latest first
pnpm install
pnpm hooks              # install the git hooks — once per clone
```

> The Corepack shipped with Node 20 has stale signature keys and fails with
> `Cannot find matching keyid`: update it before enabling it.

Copy `.env.example` to `.env` and fill it in. You need a Google AI Studio key,
a Postgres URL and a Redis URL; the two services run locally however you like
them to — Docker is the short answer:

```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=wikifake -e POSTGRES_DB=wikifake postgres:17-alpine
docker run -d -p 6379:6379 redis:8-alpine
pnpm migrate            # apply the Drizzle migrations
```

Then:

```bash
pnpm dev                # the web app on :3000, the socket service on :8080
pnpm test               # unit and integration, across every package
pnpm typecheck          # what CI runs, and what it runs first
pnpm lint
pnpm build
pnpm e2e                # the browser journeys — builds the app, starts both
pnpm check              # repository compliance checks, as the hook runs them
```

`pnpm test` and `pnpm e2e` want Postgres and Redis up; without them the
integration suites skip rather than fail, which is how a green run can still
be an incomplete one.

## What is where

```
apps/web         Next.js — the screens, the REST API, the auth, the SEO surface
apps/realtime    the WebSocket service — Hono, ws, Redis
apps/e2e         the Playwright journeys
packages/protocol  ★ every contract, as Zod schemas
packages/domain    ★ the rules: scoring, grading, items, the room reducer
packages/article   Wikipedia, the model, the cache
packages/db        Drizzle: schema, migrations, queries
packages/ui        the design system
packages/env       the validated environment
packages/config    shared tsconfig, eslint and vitest presets
```

The two marked ★ are why the rewrite happened: they hold each truth once, so
the scoring scale, the item identifiers and the message shapes cannot drift
between a client and a server that disagree.

## Documentation

Everything is in **[`plans/`](plans/README.md)**. Three entry points:

- **`plans/method/`** — how we work: phases and steps, git flow, repository
  rules. Read before contributing.
- **`plans/current-state/`** — how the code works today.
- **`plans/rewrite/`** — where the project is going, phase by phase.

Agents read `CLAUDE.md` at the root, which points to these documents and
restates the non-negotiable rules.

## Project status

The rewrite is at phase 10 — the cutover. Python and FastAPI are gone;
progress is tracked in [`plans/README.md`](plans/README.md), which is the only
file that says where the project stands.
