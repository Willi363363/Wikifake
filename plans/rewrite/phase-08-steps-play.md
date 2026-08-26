# Phase 8 — steps: what happens while the round runs

> Steps 8.3 to 8.6 — items, effects, cursors, leaderboard. The phase sheet,
> its exit gate and where each step stands: `phase-08-frontend-round.md`.
> The article: `phase-08-steps-article.md`. How a round ends:
> `phase-08-steps-end.md`.

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
