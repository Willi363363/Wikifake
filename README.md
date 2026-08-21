# WikiFake

A misinformation-detection game. The server fetches a Wikipedia article, a
language model injects factual errors into it, and players have to find
them — alone or together, sabotaging each other with items.

The principle that structures everything else: **the server is the only
authority, and the solution never leaves it before the end of the round.**

## Getting started

The project is migrating to a TypeScript monorepo. Both stacks coexist until
phase 10; see [`plans/README.md`](plans/README.md).

### Monorepo (the target)

```bash
nvm use                 # Node 22, pinned by .nvmrc
corepack enable pnpm    # if needed: npm i -g corepack@latest first
pnpm install
```

Then `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm format`.

> The Corepack shipped with Node 20 has stale signature keys and fails with
> `Cannot find matching keyid`: update it before enabling it.

### Current stack (Python + Vite)

```bash
make hooks     # install the git hooks — once per clone
make build     # backend dependencies, frontend build, then launch
make run       # frontend build + server            → http://localhost:8000
make front-dev # Vite with HMR on :5173, proxies /api and /ws to :8000
make test      # backend tests
make check     # repository compliance checks
```

In development, two terminals: `make back` on one side, `make front-dev` on
the other, then `http://localhost:5173`.

You need a Google AI Studio key in `.env` — see `backend/.env.example`.

## Documentation

Everything is in **[`plans/`](plans/README.md)**. Three entry points:

- **`plans/method/`** — how we work: phases and steps, git flow, repository
  rules. Read before contributing.
- **`plans/current-state/`** — how the current code works.
- **`plans/rewrite/`** — where the project is going, phase by phase.

Agents read `CLAUDE.md` at the root, which points to these documents and
restates the non-negotiable rules.

## Project status

The project is entering a complete rewrite of its stack: Python and FastAPI
give way to a TypeScript monorepo. Progress is tracked in
[`plans/README.md`](plans/README.md).
