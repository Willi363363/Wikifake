# Current state — backend (`backend/`)

FastAPI. `main.py` only exposes `app`; everything else lives under `src/`.

## The modules

| Directory / module | Role |
|---|---|
| `src/core/` | The game itself: Wikipedia scraping, LLM generation of the fake facts, answer checking, fact-checking of the reports. No web dependency. |
| `src/core/settings.py` | Every tunable limit: paragraph thresholds, search bounds, HTTP timeout, max nickname and chat sizes. Overridable by environment variable. |
| `src/api/` | The HTTP routes, one per domain (`game`, `rooms`, `flags`, `health`) + `static_files` which serves the built frontend. |
| `src/realtime/` | WebSocket multiplayer: `room` (state + nickname validation), `handlers` (one function per message type + dispatch table), `broadcast`, `items`, `scoring`, `themes`, `ws` (the endpoint). |
| `src/app.py` | `create_app()`: assembles the routers then the static mount. |
| `src/game.py` | `generate_game(category)` — **stateless** generation, served from the cache when possible. A shared instance used to memorise the last game, and two simultaneous players overwrote each other. |
| `src/article_cache.py` | Cache of falsified articles. Every game used to regenerate everything from scratch: that was the main cost centre, and the ten-second wait at launch. Interface reduced to `get` / `put` so that a shared store (Redis, Postgres) can replace it in a single file. |
| `src/usage.py` | Model call counters, exposed by `/api/usage`. Without measurement, no way to know what a game costs. |
| `src/scoring.py` | **The scoring rules**, shared by solo and multiplayer. `realtime/scoring.py` re-exports it and only adds the ranking. |
| `src/solo.py` | Server-side solo sessions: article, timer start, paid hints. Solo needs it for the same reason as multiplayer — without server state, the solution cannot stay hidden. |
| `src/log.py` | `get_logger(__name__)`. No `print` in application code. |
| `src/version.py` | `VERSION`, maintained by hand. Exposed by `/api/health` to spot at a glance what runs in production. |

Room and solo-session state is **in memory**: restarting the server wipes
ongoing games, and the service must run as a single process (`--workers 1`).

## HTTP routes

| Method | Route | Role |
|---|---|---|
| `GET` | `/ping` | Liveness probe, minimal (load balancers) |
| `GET` | `/api/health` | Version, deployed commit, model — see `04-deployment.md` |
| `GET` | `/api/usage` | Model consumption and cache efficiency |
| `POST` | `/api/multiplayer/create` | Creates a room → `{room_code}` |
| `POST` | `/api/game/start` | Solo game → `{session_id, …}`, **without the solution** |
| `POST` | `/api/game/hint` | Buys a hint (level 1 or 2), charged server-side |
| `POST` | `/api/game/scan` | Detector item: the server designates a paragraph |
| `POST` | `/api/game/submit` | Grades and **delivers the solution** |
| `POST` | `/api/flag-report` | Reports a genuine factual error |

## How it works

Two paths enter the game:

- **Solo**: `POST /api/game/start` creates a server session (`src/solo.py`)
  and returns the article without the solution. The player can buy hints
  (`POST /api/game/hint`, charged server-side), trigger the Detector
  (`POST /api/game/scan`), then submit their selection
  (`POST /api/game/submit`), which grades, computes the score from server
  state and delivers the full solution.
- **Multiplayer**: `POST /api/multiplayer/create` returns a `{room_code}`,
  then everything goes through the WebSocket — see `03-websocket-protocol.md`.

In both cases article generation (`src/game.py`) is stateless and serves from
the cache (`src/article_cache.py`) when possible; the single scoring rules
live in `src/scoring.py`, and every model call is counted by `src/usage.py`.
