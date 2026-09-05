# Running the project locally

From a fresh clone to a game you can play, and the traps that cost an hour
each. The stack itself is described in `01-packages.md` and `02-web.md`; this
file is only about getting it running.

## What you need

- **Node 22**, pinned by `.nvmrc`. Not 20 — the project uses `node:sqlite`.
- **pnpm**, through Corepack.
- **Postgres** and **Redis**. Docker is the short answer; anything works.
- **A Google AI Studio key**, for the model that falsifies the paragraphs.

## Install

```bash
nvm use                 # Node 22
corepack enable pnpm    # if it fails, see the trap below
pnpm install
pnpm hooks              # the git hooks — once per clone
```

## Services and environment

```bash
docker run -d --name wf-pg \
  -e POSTGRES_PASSWORD=wikifake -e POSTGRES_DB=wikifake \
  -p 5432:5432 postgres:17-alpine
docker run -d --name wf-redis -p 6379:6379 redis:8-alpine

cp .env.example .env    # then fill it in
pnpm migrate            # apply the Drizzle migrations
pnpm seed               # optional: development data, idempotent
```

`.env.example` documents every variable, and **`packages/env/src/index.ts` is
the schema of record** — a variable added to the example but not declared
there is silently ignored, which reads as a bug in whatever needed it.

The two that stop you immediately if they are wrong:

- `GOOGLE_GENERATIVE_AI_API_KEY` — without it no round can start.
- `BETTER_AUTH_SECRET` — at least 32 characters. Generate it:
  `openssl rand -base64 32`.

Social sign-in is optional. A provider with no credentials is simply not
offered, and the game is fully playable without any. Setting **one half** of a
pair throws on boot, naming the missing variable — deliberately, because a
sign-in button silently absent is worse than a startup error.

## Run it

```bash
pnpm dev        # web app on :3000, socket service on :8080
```

## The commands CI runs

```bash
pnpm test           # unit and integration, every package
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm e2e            # Playwright journeys — builds, then starts both services
pnpm check          # repository compliance, as the pre-commit hook runs it
```

## Four traps, each of which has cost an hour

**`nvm use` does not take effect in a non-interactive shell.** It prints "Now
using node v22" and `node -v` still answers v20, so pnpm fails with
`ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` — which reads as a broken install
rather than a `PATH` problem. In a script, export the path instead:

```bash
export PATH="$HOME/.nvm/versions/node/v22.<yours>/bin:$PATH"
```

**The tests skip rather than fail without Postgres and Redis.** Around 250
cases. A run with the services down is green and means nothing. **Read the
`skipped` count**, not the colour: a real run says `0 skipped`.

**Turborepo replays a green it did not run.** `pnpm typecheck` can answer
`FULL TURBO` in 56ms on a worktree that has never type-checked anything. To
actually execute, use `pnpm exec turbo <task> --force` — note that
`pnpm <task> -- --force` passes the flag to `tsc` instead, and fails.

**Corepack shipped with Node 20 has stale signature keys** and fails with
`Cannot find matching keyid`. Update it first:
`npm i -g corepack@latest`.

## Before you push

```bash
bash scripts/checks.sh staged            # what the hook runs
bash scripts/checks.sh diff origin/staging   # what CI runs
```

Both sides run the same file, so there is no local version drifting from a CI
version. The rules they enforce are in `../method/02-repository-rules.md`.
