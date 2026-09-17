# Track P — the two ways out track O refused to invent

| | |
|---|---|
| **State** | 🔶 planned — three steps, none started |
| **Branch** | one per step |
| **Depends on** | nothing. Every step repairs code that is already in production |
| **Delivers** | a client that stops asking when the answer cannot change, and a room a player can enter from a link |

## Why this track exists

Track O closed five entries of `../current-state/12-realtime-debt.md` in a day
and **deliberately left two**, for a reason it stated rather than hid: each one
is answered by a *screen*, and choosing a screen is a product decision a
hardening track should not make between two commits.

This track is that decision, taken on purpose. The two are together because
they are the same shape — **a client stuck in a state that has no way out** —
and because both end in a small piece of interface rather than in a constant.

## What is still true, from the register

### The client retries for ever, once a second, with no backoff

`provider.tsx:169` — `retry.current = setTimeout(open, RETRY_MS)`, `RETRY_MS =
1000`, no cap and no growth. A service that is down is asked again by every open
tab, once a second, indefinitely. Beside O.1's crash it was an amplifier: the
instance restarted into every tab reconnecting at once.

`attempts` is already counted, at `provider.tsx:116`, and used for nothing but
the choice between `connecting` and `reconnecting`.

### A tab with no nickname waits for ever, and says "en attente"

`room-gate.tsx:77` keys its effect on `[code]` alone. `readNickname()` answers
null, the identity is set to null, and since the code does not change **the
effect never runs again**. The provider stays idle on a `playerName` of null,
the socket never opens, and `room.tsx:206` renders a badge reading *en attente*
with nothing to act on.

The nickname is in `sessionStorage`, so this needs a room URL opened in a tab
that never went through `/play` — a second tab, or a restored session. **There
is no share-a-link feature today, which is the only reason it is rare.** The day
one exists, this is the first thing a guest meets.

## The three decisions this track takes

### The cap is not a number, it is the grace window

A retry loop needs somewhere to stop, and inventing *"five attempts"* would be
one more constant nobody can defend in six months. There is already a value that
says exactly when retrying stops being able to help:

```
GRACE_SECONDS = 30   // packages/domain/src/room/state.ts:217
```

Inside it, the seat is still held and a reconnection **gets the round back**.
Past it, `tokens.ts` has forgotten the token, the player has been evicted, and
what a successful socket produces is not a reconnection at all — it is a new
player joining a round in progress. So the loop retries while a reconnection can
still restore something, and stops when it cannot.

`apps/web` already depends on `@wikifake/domain` and already imports from it in
client components (`account/badges.tsx`), so this is the constant itself and not
a copy of it.

**Delays double and the last one is clamped to land on the deadline**: 1s, 2s,
4s, 8s, 15s — five attempts, cumulative 1, 3, 7, 15, **30**. Then it stops.

**The limit, stated rather than discovered later**: `REALTIME_GRACE_SECONDS` can
override the window on the server, and the client cannot read it. An operator
who raises it gets a client that gives up early. Telling the client its own
grace window is a protocol change and it is not worth one for a value nobody has
ever set — but it is written here so that the day somebody sets it, this page
says why the client gave up at thirty seconds.

### Giving up is a state, and the state gets a screen

A sixth `ConnectionStatus`, `lost`: dropped, retried, and not coming back on its
own. It is not `closed` — `closed` means *the server refused you and said why*,
and `refusal` carries its sentence. `lost` means nobody refused anything and the
player is owed an action rather than an explanation.

The badge is not enough for it. Every other status is a **state of a room that
is still working**; this one is a room that has stopped, so it gets a card over
the room with the code, one sentence, and two ways out: **try again**, which
restarts the loop from the first delay, and **back home**. A badge reading
*connexion perdue* over a roster frozen ten minutes ago is the same lie as
*en attente*, one word longer.

### A tab with no nickname is asked, not redirected

The alternative was `redirect('/play')`, and it is wrong for the case that makes
this worth fixing: a player who opened a room link. Sending them to the lobby
**throws the room code away** and asks them to type it back in from a URL they
can no longer see. The prompt keeps the code, asks the one thing that is
missing, and lands them in the room they were invited to.

It is not `/choose-a-name`. That screen names an *account* — it redirects a
guest to sign-up by design (`09-admin-role.md`'s neighbour, step E.3.2) — and
what is missing here is a nickname for one tab.

Validated against `playerName` from `@wikifake/protocol`, which is the schema
the server refuses with, for the reason `lobby/entry.tsx` gives at its own top:
a name the client waves through is a socket that opens and is then closed, and a
player shown a dead connection instead of *that nickname is not allowed*.

## Steps

| # | Step | State |
|---|---|---|
| P.1 | The retry backs off, and stops when the seat is gone | ⬜ |
| P.2 | The screen for a connection that is not coming back | ⬜ |
| P.3 | A tab with no nickname is asked for one | ⬜ |

**P.1** — `provider.tsx`. Delays double from `RETRY_MS` and clamp to the grace
deadline; `attempts` stops being decorative; a sixth status is reached when the
last one fails. The provider exposes a way to start again, because P.2 needs
one and nothing else can own it.

**P.2** — the card, in `lobby/`, on `status === 'lost'`. Copy in `fr` and `en`,
under `lobby.room`, beside the four connection strings that are already there.
*Salon*, never *salle* — step 11.10 settled that and `i18n/glossary.test.ts`
enforces it.

**P.3** — `room-gate.tsx`. The effect gains the nickname as a key, and the gate
renders the prompt instead of its children while there is a code and no name.
The provider stays mounted: it is the `(game)` layout's, and unmounting it is
the reconnection storm the file's own header warns about.

## Exit gate

- **A test per step that fails without its fix**, checked by removing the fix
  rather than by assuming — track O's gate, and the reason its six repairs are
  believable.
- Fake timers prove the delays: five attempts and no sixth, and the fifth lands
  at the grace deadline rather than after it.
- A room opened in a tab with no nickname reaches an open socket, in a browser
  journey and not only in a unit test — `[code]` was keyed wrong for months and
  **every unit suite passes the nickname in as a prop**, which is the sentence
  `room-gate.tsx:56` already writes about the last time this broke.
- `12-realtime-debt.md` loses both entries, in the pull requests that close
  them. It is then a register with nothing in it, and that is a fact about the
  service rather than a reason to keep a line.
