# Phase 8 — Round frontend

| | |
|---|---|
| **State** | to do |
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

### 8.1 — Article and paragraph selection

`GameSession` recomposed, `ArticleCard`, `ArticleBody`, `ArticleToken`,
`Brief`, `TopBar`, `Footer`, timer. `ArticleToken` becomes a focusable
interactive element (role, keyboard) — it is the central gesture of the
game. The CC BY-SA attribution ("deliberately altered text" + licence +
link) is visible during the round. Paragraph indexes in base 1, as in the
contract.

**Done when**: selection and deselection work by click and by keyboard, and
the negative assertion passes — no original text, no explanation, no
position in the DOM during the round.

### 8.2 — Hints

`IntelOverlay`, `HintLockedNotice`, `useHints` (`HintsPanel` is dead, it is
not ported). Levels are requested from the server and displayed as
received — monotonic, billed once. `useHints` no longer resets on
`totalFakes`, which only worked because `GameSession` was unmounted between
rounds: the key becomes the round identifier.

**Done when**: buying level 2 then requesting level 1 again displays level
2 without rebilling, and `hints_blocked` displays without a crash.

### 8.3 — Items: rebuild

Not a port: `GameSession.jsx:376` passes `onUse={useItem}` while `useItem`
is neither imported nor defined — a `ReferenceError` on rendering any
multiplayer round with items — and nothing ever calls `setItemModal`, so
the chain "click an item → choose the target → `use_item`" has no entry
point. We start again from the components (`ItemBar`, `ItemCard`,
`ItemTargetModal`, `ItemNotification`) and the single catalogue of
`packages/protocol`, and write the entire usage chain: click, targeting if
the item asks for one, send, effects received.

**Done when**: every item in the catalogue can be used in multiplayer,
targets validated by the server, and the render tests pass
`withItems: true` — the current smoke test rendered with
`withItems: false`, which is how the bug survived.

### 8.4 — The eight visual effects

Blackout, Blizzard, Confetti, Earthquake, Fog, Lightning, Rickroll, Static,
plus `useItemEffects`. Two fixes along the way: particles drawn from
`Math.random()` inside render-time `useMemo`s (non-deterministic hydration)
are generated after mount, client-side only; and `Static` — the only canvas
in the project, TV noise drawn pixel by pixel at ~25 fps, the most delicate
port — keeps its `requestAnimationFrame` cleaned up and reads dimensions in
the effect, never at render. `prefers-reduced-motion` neutralises shakes
and flashes.

**Done when**: every effect triggers and fades on its server message, no
hydration warning, `reduced-motion` verified by test.

### 8.5 — Live cursors

`useLiveCursors`, `PlayerCursor`. Two leaks closed: `window.innerWidth`
read at render (`GameSession.jsx:348`) — positions stay `[0,1]` fractions
converted to CSS `%`, no window read at render; and the cursors of departed
players, today never removed from the state, are purged on the departure
message.

**Done when**: a player who leaves sees their cursor disappear for the
others, and the component renders without touching `window`.

### 8.6 — Live leaderboard

`FloatingLeaderboard` (the dead sidebar variant is not ported), fed by
`live_score`, sorted by descending score, client-side send pacing on top of
the phase 6 server throttle.

**Done when**: four players see the same order, and `live_score` sending is
throttled client-side and server-side alike.

### 8.7 — Debriefing

`Debrief` and `AnimatedRanking`. The statistics reveal is today a 5,400 ms
`setTimeout` tuned "by ear" to the roughly 5.1 s sequence of
`AnimatedRanking`: the sequencing becomes a single scheduler — the
animation signals its end, the debriefing follows. The solution (positions,
explanations) is only displayed from `game_end` onwards, and the CC BY-SA
attribution stays visible after the round.

**Done when**: slowing the animation down no longer desynchronises the
reveal, and the attribution assertion passes on the end screen.

### 8.8 — Factual error flagging

`FlagButton`, `FlagCaptureModal`, `FlagReportForm`, `FlagToast`, wired to
`POST /api/flag-report` (phase 4), the model's verdict displayed.

**Done when**: a submitted flag appears in the database (`flag_report`) and
the toast reflects the verdict.

### 8.9 — Multiplayer end to end

The reference Playwright test: four browsers in one room, theme voting,
round with items, debriefing. The negative assertions run during the round,
on every client.

**Done when**: the 4-player game plays end to end, items included, and the
negative assertions pass on all four clients.

### 8.10 — English user interface

The user interface is now written in English: every player-facing string —
labels, buttons, notices, error messages — becomes English. The test that
locks `lang="fr"` in `frontend/src/__tests__/indexing.test.js` must be
updated accordingly, along with the SEO metadata. The CC BY-SA attribution
stays legally required, but is now written in English. Article content
itself stays French, because the game reads `fr.wikipedia.org`. French
comes back later through proper internationalisation — see
`phase-11-i18n.md`.

**Done when**: no French player-facing string remains on the round screens,
the updated `indexing.test.js` and the SEO metadata assertions pass, and
the English CC BY-SA attribution stays visible during and after the round.

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
