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

Notes written when the step was done:

- **Names, glyphs and blurbs are a third table**, `round/item-labels.ts`,
  exhaustive over `ItemId` by type. The identifiers are the contract and the
  mechanics are the rules; neither carries a name, and the current catalogue
  returns `{}` for an identifier it does not know — so a missing entry drew a
  blank card instead of failing. Step 8.10 and phase 11 own the language.
- **One throw in flight at a time.** `item_used` names the kind, not the
  instance, so attributing a refusal to the card that caused it needs the
  bar to be sending one thing at a time. It also stops a player firing
  three items and being unable to tell which was refused.
- **The two item refusals are not the same refusal.** `invalid_target` is
  refused before the item is spent, so the card stays in hand;
  `item_not_held` means the hand on screen is stale, so it goes. The current
  server sends neither.
- **A refusal is displayed by whoever owns the code.** `useRoom` now skips
  `hints_blocked`, `invalid_target` and `item_not_held`, because the intel
  panel and the item bar show them — displayed by both, the same sentence
  appears twice on one screen. The visual effects themselves are 8.4: an
  item that lands is a notice, and not yet a shaking article.

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

Notes written when the step was done:

- **Eight overlays and seven distortions, from one table.** The step names
  the eight components; what it does not say is that five items — `MIRROR`,
  `TINY`, `SPIN`, `INVERT` and half of `BLUR` — have no overlay at all and
  are done to the article card instead. `EFFECTS` in `round/effects.ts` is
  exhaustive over `ItemId`, so both halves are decided in one place and an
  item added to the contract without a look fails to compile.
- **Counted, not flagged.** Two of the same item land often in a room of
  four, and a flag means the first cast's expiry switches off the second
  that is still running.
- **`prefers-reduced-motion` is read with `useSyncExternalStore`.** Read in
  an effect instead, the first render says "full motion", the canvas loop
  starts, and it is cancelled on the second render — so a viewer who asked
  for less motion gets one frame of exactly what they asked not to see. The
  separate server snapshot is what keeps the synchronous read from being a
  hydration mismatch.
- **Nothing covers the article's controls.** Every sheet but the pop-up is
  `pointer-events-none`, and the distortions do not disable the card. The
  current blur sets `pointerEvents: 'none'` on the article, which turns a
  five-second nuisance into five seconds of not playing.
- **The pop-up is not a `Dialog`.** It is done *to* the player, so trapping
  their focus in it would be an item that takes the keyboard away until it
  is closed.

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
