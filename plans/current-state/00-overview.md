# Current state — overview

WikiFake is a misinformation-detection game: the backend fetches a Wikipedia
article, an AI injects factual errors into it, and players have to find them —
alone or together, sabotaging each other with items.

This series of documents describes **what exists**, as it runs in production:

- `01-backend.md` — the modules and the HTTP routes.
- `02-frontend.md` — the frontend directories and the rules to hold.
- `03-websocket-protocol.md` — the realtime protocol and the scoring rules.
- `04-deployment.md` — the Docker image, Render and the deployment probe.
- `05-known-debt.md` — the verified defects, with their references.

## The principle that structures everything else

**The server is the sole authority, and the solution never leaves it before
the end of the round.**

Concretely:

- The start payload (`game_start`, `POST /api/game/start`) contains the
  article and the *number* of falsified paragraphs — never which ones, nor
  the explanations, nor the hints.
- The score is computed by the server from its own state. The client only
  sends its paragraph selection.
- Hints are charged per call and delivered by the server.
- The full correction arrives with `game_end` / the response of
  `POST /api/game/submit`.

Any change that would send the solution or a score computation back to the
client breaks this principle. Several tests lock it explicitly
(`test_solution_hidden.py`, `test_score_integrity.py`, and on the frontend
the negative assertions of the smoke test).

## All state lives in memory, in a single process

Room and solo-session state is **in memory**: restarting the server wipes
ongoing games, and the service must run as a single process (`--workers 1`).
There is no database: the room registry, solo sessions, article cache and
usage counters live in the process RAM. A second instance breaks everything.
The only disk persistence is `backend/data/complaints.jsonl`, ephemeral on
Render free.

## Getting started

```bash
make build       # backend venv + deps, frontend build, then launch
make run         # frontend build + server          → http://localhost:8000
make back        # server only (frontend already built)
make front-dev   # Vite with HMR on :5173, proxies /api and /ws to :8000
make test        # backend tests
```

The frontend needs `npm`: `cd frontend && npm install` (done automatically by
`make front` / `make run`).

In dev, work with **two terminals**: `make back` in one, `make front-dev` in
the other, and open `http://localhost:5173`.

Tests:

```bash
make test                     # backend (pytest)
cd frontend && npm test       # frontend (vitest)
cd frontend && npm run smoke  # server-side render of the full tree
```

## Volume

- Backend: 4,339 lines of Python, 14 modules under `backend/src/`,
  15 test files.
- Frontend: 8,442 lines, zero TypeScript, 2 runtime dependencies (react,
  react-dom), ~1,300 lines of global CSS and ~430 inline style objects.
