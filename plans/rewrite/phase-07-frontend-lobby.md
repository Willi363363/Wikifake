# Phase 7 — Pre-round frontend

| | |
|---|---|
| **State** | in progress — two steps done |
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

### 7.1 — Client WebSocket context ✅

Today the socket is created by `useRoomConnection`, survives the round, and
travels as a prop (`ws={socket}`) from component to component. It becomes a
React provider mounted in the client layout of the `(game)` group:
connection, token-based reconnection (phase 6), messages typed by
`packages/protocol`, a single consumption hook.

Five decisions taken while writing it:

- **The provider knows nothing about routing.** It takes a room code and a
  nickname and owns a socket; a separate `RoomGate` reads them from the URL and
  from `sessionStorage`. That is what makes the connection testable without a
  router, and it is the seam every later step plugs into.
- **The nickname lives in `sessionStorage`, beside the token.** Same lifetime,
  same tab. It is what the player typed on the entry screen, not something the
  URL carries, and a refresh mid-game must not cost them their seat.
- **`sessionStorage`, not `localStorage`, for the token.** "As long as the tab
  lives" is exactly what `sessionStorage` means. In `localStorage` a tab opened
  tomorrow could reclaim a seat from last week, and two tabs would share one
  token and fight over the same nickname.
- **A refusal is final; a network drop is not.** Close 1008 carries the server's
  reason — `name_taken`, `room_not_found` — and retrying it produces the same
  answer for ever. Anything else is retried after a second, comfortably inside
  D5's thirty-second window.
- **Messages are dropped rather than queued while the socket is down.** Every
  message this client sends is about the room as it is *now*, and a `set_ready`
  delivered after a reconnection is about a room that has moved on.

**Bug 2.1.10 is fixed here** rather than in 7.2, because this is the only place
a socket URL is built: the nickname is percent-encoded, so "Jean Dupont"
connects. The server's own schema has always allowed the space.

`NEXT_PUBLIC_REALTIME_URL` is new. The current client connects to
`window.location.host`, which works only because a dev proxy forwards `/ws` to
the backend; the rewrite deploys the app and the socket service to two
platforms, so the address is a deployment fact. Left empty it falls back to the
page's own host, which is what a single-origin development setup wants.

**Done when**: no component receives the socket as a prop any more, and a
lobby → round navigation does not reopen the connection.

### 7.2 — Entry: solo, host, join ✅

`LobbyEntry` and `LobbyCard` ported: nickname choice, the three tabs, room
creation, code input. The nickname is validated client-side with the same
`protocol` schema as the server, and **encoded** in the WebSocket URL — bug
2.1.10: the server regex allows spaces, the client does not encode them.

Four decisions taken while writing it:

- **The nickname is refused by the contract's own schema, before any network
  call.** Today the client checks `!username`, which a 200-character name full
  of emoji passes: the socket opens, the server refuses it, and the player is
  shown a closed connection rather than a reason. `playerName` from
  `@wikifake/protocol` is the same schema the server refuses with, so the two
  cannot disagree.
- **Length is capped by the field, not refused after the fact.** A player who
  pastes a paragraph gets the first 24 characters, rather than an error about
  something they cannot see the end of. The schema still guards what a cap
  cannot — emoji, punctuation, a name that is only spaces.
- **The room code is upper-cased as it is typed.** `a1b2c3` is a room; the
  server's codes are upper-case by construction, and lower case is a 404 nobody
  can diagnose.
- **The code is checked before the nickname.** A player who mistyped both is
  told about the code, and their nickname is not remembered against a room that
  does not exist.

**Solo needs no nickname.** There is no room and no socket: the round is played
by whoever is holding the browser. The current screen asks for one anyway on two
of its three tabs and ignores it on the third.

The entry lives inside the `(game)` group, so opening or joining a room is a
navigation *within* the provider of 7.1 and the socket opens exactly once. Its
three destinations — `/solo`, `/room/[code]` — are real routes with placeholders
that say which step fills them in. The room placeholder reports the connection
status, which is the one thing 7.1 delivered and the one thing a reviewer can
check by hand today: two tabs on the same code, both `open`.

One trap: Next refuses to prerender a page that reads the query string
unbounded, so `/solo` wraps that read in `Suspense`. The build fails outright
without it, which is the right failure.

**Done when**: the three entries lead to the right screen, an invalid
nickname is refused before any network call, a nickname with a space
connects.

### 7.3 — Waiting room

`RoomLobby`, `PlayerList`, host settings (`TimeLimitSlider`,
`ItemsToggle`), ready state. The settings are hidden from guests but the
truth stays server-side: a received `not_host` is displayed cleanly, it
does not crash the screen.

**Done when**: two browsers see each other in the same room, a guest
cannot change the settings, host promotion on departure is reflected on
screen.

### 7.4 — Theme voting

`ThemeVoting` ported: proposals, votes, `force_pick` reserved to the host,
result announced by the server.

**Done when**: the theme displayed as elected is the one from the server
message, never a local tally.

### 7.5 — Generation screen

`WaitingScreen` loses its imperative handle: today the lobby calls
`ref.ready(data)` through `useImperativeHandle` when the round arrives. The
screen becomes state-driven — it reads `game_start` from the context of
7.1, and its progress is data, not a handle.

**Done when**: no more `forwardRef` or handle, and the screen leads into
the round in solo as in multiplayer.

### 7.6 — The six waiting minigames

Snake, DinoRun, MemoryCards, ReactionSpeed, PatternMatch, TicTacToe, plus
`ProgressTracker` and `GameLauncher`. All DOM + CSS, no canvas: the port is
mechanical — client components, inline styles to the theme, timers and
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

**Done when**: the solo Playwright test passes — enter a nickname, pick a
topic, play, see your score.

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
