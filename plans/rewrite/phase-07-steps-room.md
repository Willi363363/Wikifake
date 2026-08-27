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

**The current screen breaks a smaller version of the same rule before the
election is reached.** It sets a local `submitted` flag the moment the form is
sent, so a ballot the server refused — the vote had closed, or the socket was
already down — still reads as submitted, and the player waits for a vote they
are not in. Here "you have voted" is `theme_vote_update.submitted` containing
your name, which is the server's answer to the same question.

Two decisions taken while writing it:

- **The phase is derived from the messages that arrive**, because nothing
  carries it. `theme_vote_start` opens the vote, `theme_selected` closes it,
  `game_start` and `game_end` bracket the round. That works for a player who was
  there; see the gap below for the one who was not.
- **`proposer: null` is rendered as "drawn by the server".** The current server
  sends the string `"Système"` there — both a magic value and the last French
  string on the wire — and the contract replaced it with `null` precisely so a
  screen would have to say what it means.

**Found here, and larger than this step**: nothing tells a client what phase a
room is in. Neither `lobby_update` nor the answer to `get_lobby` carries it, and
`game_start` is broadcast once, at the start. So a player who reconnects
mid-vote sees a lobby, and one who reconnects mid-round **cannot re-enter the
round at all** — the article is not sent again.

That is the client half of D5. The server keeps the seat, the score, the paid
hints and the items, all of which 5.5 proved; the browser coming back has no way
to ask what it is holding. It wants a protocol message — a room's current state
on demand — and that is phase 1's contract, not a screen's business. Recorded
alongside the missing room options of 7.3, which is the same shape of gap.

**Done when**: the theme displayed as elected is the one from the server
message, never a local tally.

### 7.5 — Generation screen

`WaitingScreen` loses its imperative handle: today the lobby calls
`ref.ready(data)` through `useImperativeHandle` when the round arrives. The
screen becomes state-driven — it reads `game_start` from the context of
7.1, and its progress is data, not a handle.

The handle goes because it is unnecessary, not because it is unfashionable.
Progress is a function of two things — how long we have waited, and whether the
round has arrived — and neither needs one component to reach into another. It is
`progressAt(elapsedMs, arrived)`, tested as arithmetic: it never runs backwards,
never leaves the scale, and **never passes 85% on its own**, because a bar that
reaches 100% before the article does is a bar that has lied.

Three decisions taken while writing it:

- **The screen decides when it is finished.** It stays mounted after
  `game_start` arrives, fills its bar, and then announces that it is done. That
  is what replaces `ref.ready(data)`: the lobby no longer reaches in to end it.
- **It hands over exactly once.** A handle invoked twice pushes a player into a
  round they are already in; a test re-renders and advances the clock four times
  over and asserts one handover.
- **One screen for solo and multiplayer.** What differs is who decides `ready` —
  a socket message in one, a resolved request in the other — and that is not this
  component's business. It is what lets 7.8 wire solo through the same screen
  without a second copy.

C3.7 is honoured on the way: an `error` with `generation_failed` puts the room
back in the lobby, because the server already has. Without it the screen waits
for an article that is not coming, which is the state the current server leaves
it in.

**Done when**: no more `forwardRef` or handle, and the screen leads into
the round in solo as in multiplayer.

Two of the tests check the shape of the file rather than its behaviour, which is
unusual enough to justify: this phase's own pitfall list names "the temptation to
port the handle just for now", and a rule nobody can enforce is a rule that comes
back. They assert the calls are absent and that neither name is imported — the
bare words appear in the file's comment explaining why it uses neither, which is
how the first version of that test failed.
