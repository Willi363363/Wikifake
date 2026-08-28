# Rewrite — overview

This document gathers the frame of the rewrite: the decisions made, the
measured starting point, the target architecture, the test strategy, the risks
and the split into phases. The detail of each phase lives in its file
`phase-NN-<topic>.md`. Progress lives in `plans/README.md`, and nowhere else.

The most important document in this folder is not this one: it is the contract
to preserve, split between `01-contract-to-preserve.md` and
`02-contract-transport-and-compliance.md`.

## Decisions made

| Topic | Decision |
|---|---|
| Runtime | TypeScript end to end, Turborepo + pnpm monorepo |
| Frontend | Next.js 16 (App Router, RSC), React 19 |
| API | Next.js Route Handlers + Hono for realtime, Zod as the single source of truth for contracts |
| Realtime | Self-hosted WebSocket service + Redis (room state, pub/sub, scheduling) |
| Persistence | Neon Postgres + Drizzle ORM; Upstash Redis for the ephemeral |
| Hosting | Vercel (web) + Render free (realtime) + Neon + Upstash |
| Scope | Iso-functional + accounts, persistence, history, statistics |
| Design | Tailwind v4 + shadcn/ui, current visual identity transcribed into a theme |
| LLM | Vercel AI SDK + AI Gateway, Gemini by default, `generateObject` validated by Zod; LangChain goes away |
| Auth | Better Auth in the project's own Postgres |
| Method | Big bang on `willi363/refonte`, one final PR; the Python is deleted in phase 10 |
| Language | Everything in English — code, documentation, commits, UI; French comes back through internationalisation in phase 11 |

What disappears from the stack: Python 3.10, FastAPI, uvicorn, LangChain,
`wikipedia`, BeautifulSoup, pytest, Vite, untyped JavaScript, hand-written
global CSS, the ~430 `style={{}}` objects, the single-container Docker,
Render, `complaints.jsonl`, and all in-memory state.

## Measured starting point

- Backend: 4,339 lines of Python, 14 modules under `backend/src/`,
  15 test files.
- Frontend: 8,442 lines, zero TypeScript, 2 runtime dependencies (react,
  react-dom), ~1,300 lines of global CSS and ~430 inline style objects.
- **Zero database.** All state lives in the RAM of a single process: room
  registry, solo sessions, article cache, usage counters. A restart empties
  the games in progress; a second instance breaks everything.
- Only disk persistence: `backend/data/complaints.jsonl`, ephemeral on
  Render free.

## Target architecture

```
wikifake/
├── apps/
│   ├── web/            # Next.js 16 — UI, auth, REST API, SEO pages
│   └── realtime/       # Node WebSocket — Hono + ws + Redis + BullMQ
├── packages/
│   ├── protocol/       # ★ single source of contracts: Zod (WS + REST)
│   ├── domain/         # ★ pure rules: scoring, grading, room FSM, items
│   ├── db/             # Drizzle: schema, migrations, queries
│   ├── article/        # Wikipedia scraping + LLM falsification + cache
│   ├── ui/             # Tailwind + shadcn design system
│   └── config/         # shared tsconfig, eslint, tailwind preset
├── turbo.json
└── pnpm-workspace.yaml
```

The two packages marked ★ are the reason the rewrite exists: they remove
**structurally** the duplicated truths of the current codebase (the scoring
scale duplicated between backend and frontend, item identifiers synchronised
by hand, two shapes of `players` in `game_start`, constants redeclared as
hard-coded values).

- **`packages/protocol`** — every WebSocket message and every REST DTO is an
  exported Zod schema: the server validates on input, the client infers its
  types from the same object, error codes form a closed union, and the
  protocol documentation is generated from the schemas.
- **`packages/domain`** — pure rules, no I/O and no implicit clock: scoring
  scale and breakdown, answer grading, item catalogue and effects, topic
  selection, and the room state machine as a reducer
  `(state, event) → {state, effects}`, testable without WebSocket, Redis or
  LLM.
- **`apps/web`** — Next.js 16: static marketing pages, lobby and round,
  account and history, API routes (health, usage, game, rooms, flag-report,
  auth).
- **`apps/realtime`** — multi-instance WebSocket: room state in Redis mutated
  by Lua scripts, broadcast via pub/sub, BullMQ timers (round end by timeout,
  item waves, room TTL), reconnection with a session token. Deployed on
  Render — Vercel does not host long-lived WebSockets.
- **`packages/article`** — MediaWiki API + cheerio (the index-parity
  invariant lives there), falsification via Zod-validated `generateObject`,
  Redis cache shared between instances.
- **`packages/db`** — Drizzle schema: auth, profiles, rooms, games,
  `game_position` (the solution, never exposed before the end), participants,
  answers, hint purchases, item usages, reports, `llm_call` (the cost per
  game becomes a query).
- **`packages/ui`** — Tailwind v4 theme from the current tokens, shadcn
  primitives, a token component with variants, `prefers-reduced-motion`,
  dark mode, responsive, keyboard accessibility.

## Test strategy

- **Unit (Vitest)** — `domain` and `protocol`: scoring, grading, reducer,
  message validation. Everything pure, hence the bulk of the rules.
- **HTML fixtures** — `article`: index parity, deduplication, whitespace
  normalisation, injection, on real frozen Wikipedia pages.
- **Integration** (Testcontainers or a Neon branch + local Redis) — API,
  database, cache, hint billing, session isolation.
- **Protocol** — a test WebSocket client against `apps/realtime`: host
  authorisation, duplicate-name refusal, surviving invalid JSON, throttles,
  reconnection, round end by timeout, two instances on the same room.
- **E2E (Playwright)** — two browsers in the same room: full journey, and the
  **negative assertions** — no sabotaged paragraph in the DOM during the
  round, no explanation, CC BY-SA attribution present before and after. This
  is the most important inheritance of the current tests.
- **Documentation lock** — the protocol doc is generated from the Zod
  schemas; the test fails if the committed file diverges from the generated
  one.

## Risks

| Risk | Effect | Treatment |
|---|---|---|
| Text ↔ DOM index parity when porting to cheerio | The player graded on the wrong paragraphs — the project's historic bug | Phase 3 early, real fixtures, parity test before anything else |
| `generateObject` changes the model's behaviour | Falsifications of different quality, more or less subtle | Prompt carried over verbatim; comparison on a fixed set of categories before touching it |
| Redis + Lua for room state | More complexity than the in-memory dict | The reducer stays pure and tested outside Redis; Redis only applies transitions already decided |
| Two hosting providers (Vercel + Render) | Operational surface, CORS and WebSocket origins to keep in check | Explicit origins and tokens from phase 5, not at the end of the journey |
| Volume of the round frontend | The round concentrates most of the frontend | Internal split by feature, each delivered with its component gallery |
| Huge, non-bisectable final PR | Hard to review | Commits per phase, conventional commits in English, structured PR message |
| Silent regression of a contract guarantee | A guarantee paid for by a production bug disappears without a sound | The contract is a checklist ticked test by test — the gate of phase 10 |

## What we do not do

- No monetisation, no organisations, no Stripe: the scope stops at accounts,
  history and statistics.
- No redesign: the current visual identity is transcribed, not rethought.
- No LLM model change in the same movement as the stack change: Gemini stays
  the default, the AI Gateway makes a later switch trivial.
- No French UI in the rewrite itself: **the entire product is written in
  English**, and French comes back later through proper internationalisation,
  in phase 11 (`phase-11-i18n.md`). Deferring it is deliberate: bolting a
  translation framework onto a UI that is being rebuilt would double the work
  of every frontend phase, whereas a single-language product keeps the
  rewrite iso-functional and reviewable, and leaves i18n a stable, fully
  extracted surface to translate afterwards.
- No porting of dead code: the CLI, the `core/prompts.py` prompt, the
  `HintsPanel` and `Leaderboard` sidebar-variant components, `get_feedback`.

## The twelve phases

Progress on these phases is read in `plans/README.md`, not here.

| Phase | Title | File |
|---|---|---|
| 0 | Foundations | `phase-00-foundations.md` |
| 1 | Core (`protocol` + `domain`) | `phase-01-core.md` |
| 2 | Data | `phase-02-data.md` |
| 3 | Article | `phase-03-article.md`, `phase-03-steps-generation.md`, `phase-03-steps-cache.md` |
| 4 | API and auth | `phase-04-api-and-auth.md` + three step sheets |
| 5 | Realtime | `phase-05-realtime.md` |
| 6 | Design system | `phase-06-design-system.md` |
| 7 | Frontend lobby | `phase-07-frontend-lobby.md` |
| 8 | Frontend round | `phase-08-frontend-round.md` |
| 9 | Observability and CI/CD | `phase-09-observability-and-cicd.md` |
| 10 | Cutover | `phase-10-cutover.md` |
| 11 | Internationalisation | `phase-11-i18n.md` |
