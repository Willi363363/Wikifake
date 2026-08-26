# Phase 7 — steps: what fills the wait, and the journey

> Steps 7.6 to 7.8. The phase sheet, its exit gate and where each step stands:
> `phase-07-frontend-lobby.md`. Getting in: `phase-07-steps-entry.md`. The room:
> `phase-07-steps-room.md`.

### 7.6 — The six waiting minigames

Snake, DinoRun, MemoryCards, ReactionSpeed, PatternMatch, TicTacToe and
`GameLauncher`. `ProgressTracker` came with 7.5 — the bar is arithmetic in
`progress.ts` and the generation screen draws it. All DOM + CSS, no canvas: the
port is mechanical — client components, styled from the theme, timers and
keyboard listeners cleaned up on unmount.

**Done when**: all six launch and replay from the waiting screen, with no
surviving timer after unmount (verified by test).

### 7.7 — A single chat

`ChatPanel` is mounted twice — one instance in `Lobby`, one in
`GameSession` — and the history is lost when the round starts. It becomes a
single instance, mounted at the level of the 7.1 provider and displayed on
both screens.

**Done when**: a message sent in the lobby is still readable during the
round, and the 400-character bound is enforced on input.

### 7.8 — Solo journey end to end

Wire solo entry → generation screen → round onto the REST routes of phase 4
(`start`, `submit`). The round used here is deliberately minimal — raw
article and submission; the rich article, hints, items and debriefing
belong to phase 8, which replaces it.

**Done when**: the journey plays through — a topic, a wait that ends when the
article does, paragraphs marked as 1-based numbers, and the score the server
decided on screen.

Two corrections to what this step used to say, both made when it was done:

- **No nickname.** 7.2 settled that solo asks for none: there is no room and no
  socket, and the round is played by whoever is holding the browser. The
  criterion said "enter a nickname" from before that decision.
- **The browser run is 9.5's.** This step's criterion used to be "the solo
  Playwright test passes", and step 9.5 already owns *Playwright e2e in CI* —
  with the fixture-served article and the fake key that run needs, and 9.4
  rewriting `ci.yml` underneath it. Two homes for one harness is how a harness
  gets built twice. The journey is proved here the way every other screen in
  this phase is, in jsdom with the two routes stubbed at `fetch`; what those
  routes *do* is phase 4's exit gate and is tested against a real database in
  `apps/web/src/game/journey.test.ts`.

## Exit gate

- A solo game plays end to end.
- No socket prop left in the tree, no imperative handle.
- The chat survives the lobby → round transition.

## Contract touched

See `01-contract-to-preserve.md`: host authority (`not_host` refusals come
from the server, the client only hides the controls), transport robustness
(nickname validated and encoded, chat bounded at 400 characters), and the
negative assertions — the generation screen only receives the **number** of
falsified paragraphs, never the positions.

## Pitfalls

- **Do not recreate the socket.** The provider lives in a layout that
  survives navigations within the `(game)` group; mounted too low, every
  screen will reopen the connection and the server will see ghost
  reconnections.
- The minigames live on `setInterval` and global listeners: a port that
  forgets a cleanup leaks the waiting screen, not the minigame.
- The temptation to port the `WaitingScreen` handle "just for now": that is
  precisely what 7.5 removes, do not reintroduce it to save an hour.
- Do not anticipate phase 8: the round of 7.8 is bare, and that is
  intended.
