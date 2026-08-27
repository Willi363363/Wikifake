# Current state — overview

WikiFake is a misinformation-detection game: the server fetches a Wikipedia
article, a model rewrites a few of its facts, and players have to find them —
alone or together, sabotaging each other with items.

This series of documents describes **what exists**, as it runs:

- `01-packages.md` — the seven packages, and which truth each one owns.
- `02-web.md` — `apps/web`: the screens, the REST routes, the auth.
- `03-realtime.md` — `apps/realtime`: the socket service, Redis, the timers.
- `04-deployment.md` — Vercel, Fly, Neon, Upstash, and the deploy probe.
- `05-known-debt.md` — the verified defects, with their references.
- `06-structural-debt.md` — the debt that is about the shape of the repository.

The protocol itself is not described here: it is **generated** from the Zod
schemas into `plans/protocol/`, and a test fails if the committed pages and the
schemas disagree. A hand-written second description would be the thing that
drifts.

## The principle that structures everything else

**The server is the sole authority, and the solution never leaves it before the
end of the round.**

Concretely:

- The start payload (`game_start`, `POST /api/game/start`) carries the article
  and the *number* of falsified paragraphs — never which ones, nor the
  explanations, nor the hints, nor the original text.
- The score is computed by the server from its own state. The client sends its
  paragraph selection and nothing else that counts.
- Hints are billed per call and their text is delivered only once paid for.
- The full correction arrives with `game_end` / the response of
  `POST /api/game/submit`.

Any change that would send the solution, or a score computation, back to the
client breaks this principle. It is not a convention: it is section C1 of
`../rewrite/01-contract-to-preserve.md`, and every clause of it points at a
named test in `../rewrite/phase-10-contract-map.md`. The strongest of those
tests are the **negative** ones — the browser journeys assert that no original
text, no explanation and no unpaid hint appears anywhere in a page during a
round, by value and not only by key.

## Where state lives

Nowhere in a process's memory, which is the single largest change the rewrite
made.

| State | Home | Why there |
|---|---|---|
| Room state, rosters, votes, live scores | Redis, mutated by Lua scripts | Any instance serves any socket; a transition is applied atomically or not at all |
| Room fan-out | Redis pub/sub, one channel per room | Two players on two instances hear the same room |
| Timers — round end, item waves, room TTL | BullMQ on Redis | A round ends because the server says so, not because a client's clock did |
| Falsified articles | Redis, 6 h TTL, three variants per topic | Shared between instances, survives a redeploy |
| Accounts, games, answers, hint purchases, model spend | Postgres via Drizzle | The cost of a game is a query, not a counter that resets |
| The solution | Postgres, `game_position` | Written at generation, read at submission, never in between |

The consequence worth stating plainly: the service runs as **many instances**,
a restart loses no game in progress, and a second instance is what the design
assumes rather than what breaks it.

## Getting started

```bash
nvm use                 # Node 22, pinned by .nvmrc
corepack enable pnpm
pnpm install
pnpm hooks              # the git hooks — once per clone
```

Copy `.env.example` to `.env`. Postgres and Redis run locally however you like
them to; Docker is the short answer, and `pnpm migrate` applies the Drizzle
migrations. Then:

```bash
pnpm dev          # the web app on :3000, the socket service on :8080
pnpm test         # every package
pnpm typecheck    # what CI runs, and what it runs first
pnpm lint
pnpm build
pnpm e2e          # the browser journeys — builds the app, starts both services
pnpm check        # repository compliance, as the pre-commit hook runs it
```

**`pnpm test` and `pnpm e2e` want Postgres and Redis up.** Without them the
integration suites *skip* rather than fail, so a green run can still be an
incomplete one — the output says `0 skipped` when it was a real one.

## Volume

| Area | Source | Tests |
|---|---|---|
| `apps/web` | 14,906 | 11,393 |
| `apps/realtime` | 2,863 | 3,509 |
| `apps/e2e` | 768 | 431 |
| `packages/domain` ★ | 2,101 | 2,442 |
| `packages/db` | 2,457 | 2,314 |
| `packages/article` | 1,960 | 1,890 |
| `packages/protocol` ★ | 1,593 | 1,304 |
| `packages/ui` | 1,256 | 1,012 |
| `packages/env` + `packages/config` | 151 | 260 |

1,884 unit and integration cases, plus eleven browser journeys. TypeScript
throughout: no untyped JavaScript, and no Python since step 10.9.
