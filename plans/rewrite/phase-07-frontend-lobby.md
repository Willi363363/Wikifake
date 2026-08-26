# Phase 7 — Pre-round frontend

| | |
|---|---|
| **State** | in progress — six steps done |
| **Branch** | `feat/rewrite-phase-7` |
| **Depends on** | phases 4, 5 and 6 |
| **Delivers** | the whole pre-round in Next.js, and a playable solo game |

## Objective

Port to Next.js everything that precedes the round: solo / host / join
entry, waiting room, theme voting, generation screen, the six waiting
minigames and the chat. Along the way, the WebSocket becomes a client
context instead of a mutable object passed as a prop through the whole
tree.

## Why now

Phases 4 to 6 delivered the solo API, auth and the realtime service: the
frontend finally has something to talk to. And the pre-round comes before
the round because it lays down the WebSocket context and the chat that
phase 8 reuses as they are — laying them down in the round first means
laying them down twice.
## Steps

Eight steps, so the definitions live in three sheets. **The tables below are the
only place that says where a step stands** — the sheets define the work and its
completion criterion, and carry no state.

| # | Step — the connection, and the way in | State |
|---|---|---|
| 7.1 | Client WebSocket context | ✅ done |
| 7.2 | Entry: solo, host, join | ✅ done |

Definitions: `phase-07-steps-entry.md`.

| # | Step — the room, and starting a round | State |
|---|---|---|
| 7.3 | Waiting room | ✅ done |
| 7.4 | Theme voting | ✅ done |
| 7.5 | Generation screen | ✅ done |

Definitions: `phase-07-steps-room.md`.

| # | Step — what fills the wait, and the journey | State |
|---|---|---|
| 7.6 | The six waiting minigames | ✅ done |
| 7.7 | A single chat | to do |
| 7.8 | Solo journey end to end | to do |

Definitions: `phase-07-steps-waiting.md`.

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
