# Phase 7 — steps: the room, and starting a round

> Steps 7.3 to 7.5. The phase sheet, its exit gate and where each step stands:
> `phase-07-frontend-lobby.md`. Getting in: `phase-07-steps-entry.md`. What
> fills the wait: `phase-07-steps-waiting.md`.

### 7.3 — Waiting room

`RoomLobby`, `PlayerList`, host settings (`TimeLimitSlider`,
`ItemsToggle`), ready state. The settings are hidden from guests but the
truth stays server-side: a received `not_host` is displayed cleanly, it
does not crash the screen.

Three defects in the current list, all of them the same shape — reading the
server rather than guessing at it:

- **The crown follows `i === 0`.** That is the server's rule reimplemented in a
  component. It agrees today and stops agreeing the first time somebody sorts
  the roster for display; `lobby_update` has always carried `isHost`.
- **The colour dot reads `player.color`**, a field the protocol has never sent.
  Every dot falls back to grey.
- **A dropped player cannot be shown at all.** D5 keeps their seat for thirty
  seconds and `lobby_update` says `connected: false`; a list with nowhere to put
  that makes a disconnection look like silence. They are `away` now, not gone —
  saying "gone" would be wrong for exactly the thirty seconds that matter.

`ItemsToggle` becomes a real `role="switch"`. The current one is a
`<div onClick>`: not focusable, no role, nothing on Enter or Space, and nothing
announcing whether items are on — the same defect as the paragraph token, on the
control that decides how the round is played. The time-limit label is associated
with its slider, which the current one is not: it is a sibling `<label>` with no
`htmlFor`, so it names nothing.

**Nothing is tallied locally.** The ready button does not flip when it is
pressed; it flips when the roster says so. That is the difference between a
screen that agrees with the server and a screen that usually agrees with it.

Hiding the settings from a guest is presentation and nothing else: C1.7 is
enforced by the server, which refuses a guest's options whether or not this
component drew them. A `not_host` that arrives anyway is displayed and changes
nothing — the roster that comes next is the truth.

**Found, and recorded rather than fixed**: `lobby_update` carries no room
options, so the time limit and the items switch live in the host's browser and
travel with `set_ready`. **A guest cannot see the round they are about to
play** — not the length, not whether items are on. It is the same in the current
game. Fixing it means adding the options to `lobby_update`, which is a protocol
change and belongs to whoever revisits phase 1's contract, not to a screen.

**Done when**: two browsers see each other in the same room, a guest
cannot change the settings, host promotion on departure is reflected on
screen.

The first clause is the server's guarantee and is tested where it lives —
`broadcast.test.ts` in `apps/realtime`, over a real Redis channel. What is
tested here is the half the current game gets wrong: that what the server says
is what the screen shows.

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
