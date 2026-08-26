# Phase 8 — Round frontend

| | |
|---|---|
| **State** | **in progress** — nine steps done, 8.9 blocked |
| **Branch** | `feat/rewrite-phase-8` |
| **Depends on** | phase 7 |
| **Delivers** | the complete round, from first paragraph to debriefing |

## Objective

Port the round: article and paragraph selection, hints, visual effects,
live cursors, leaderboard, debriefing, flagging — and **rebuild** the
items, broken in production. This is the most voluminous phase of the
project: one domain per step, each shippable on its own.

## Why now

Everything is ready underneath: the WebSocket context and the chat (phase
7), the protocol and the pure rules (phase 1), the realtime (phase 6). The
round concentrates most of the frontend — it is the volume risk identified
in §7 of the plan, and its treatment is this slicing: one feature at a
time.

## Steps

Ten steps, so the definitions live in three sheets. **The tables below are the
only place that says where a step stands** — the sheets define the work and its
completion criterion, and carry no state.

| # | Step — the article, and what it costs to be told | State |
|---|---|---|
| 8.1 | Article and paragraph selection | ✅ done |
| 8.2 | Hints | ✅ done |

Definitions: `phase-08-steps-article.md`.

| # | Step — what happens while the round runs | State |
|---|---|---|
| 8.3 | Items: rebuild | ✅ done |
| 8.4 | The eight visual effects | ✅ done |
| 8.5 | Live cursors | ✅ done |
| 8.6 | Live leaderboard | ✅ done |

Definitions: `phase-08-steps-play.md`.

| # | Step — how a round ends, and in what language | State |
|---|---|---|
| 8.7 | Debriefing | ✅ done |
| 8.8 | Factual error flagging | ✅ done |
| 8.9 | Multiplayer end to end | ⛔ blocked — needs 9.5 |
| 8.10 | English user interface | ✅ done |

Definitions: `phase-08-steps-end.md`.

**8.9 cannot be done here.** It asks for four Playwright browsers, and step 9.5
owns the harness — the browser, its CI job and the fixture-served article are set
up once, there, on top of the `ci.yml` 9.4 rewrites. Recorded when 7.8 was cut
back for the same reason. Either 8.9 moves after phase 9, or 9.5 is brought
forward; the phase cannot close until one of the two happens.

## Exit gate

- A 4-player multiplayer game plays end to end, items included.
- The negative assertions pass during the round, on all clients.
- The CC BY-SA attribution is visible during **and** after the round.
- No hydration warning on the round screens.

## Contract touched

See `01-contract-to-preserve.md`: the solution never leaves the server —
never in the DOM during the round, verified by the negative assertions (no
original text, no explanation, no position before `game_end`), by keys
**and by values**; the CC BY-SA attribution, a tested legal requirement,
during and after the round; the scoring scale and the item catalogue come
from `packages/domain` and `packages/protocol`, never redeclared on the
frontend.

## Pitfalls

- **The DOM leaks more easily than before.** With Server Components, an
  object passed from server to client is serialised into the page: the
  solution must never travel through RSC props. Hence the assertions by
  values, not only by keys.
- `Static` is costly — a full-screen `createImageData` 25 times per second.
  Client-only, animation cleaned up, cut under `prefers-reduced-motion`:
  the photosensitivity stake is real.
- The items bug lived because nothing rendered the round with items: every
  test in this phase that touches them renders `withItems: true`.
- Cascading timers (debriefing, timed effects) are tested with fake clocks,
  never with real waits.
- Four Playwright browsers are slow and fragile: a single journey in 8.9,
  kept short; everything else is tested per domain, without a browser.
