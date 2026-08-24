# Phase 1 — protocol decisions

Where the new protocol departs from the one in `backend/src/realtime/`, and
why. Written down because each one is a choice a reviewer would otherwise have
to reverse-engineer from a diff, and because the frontend phases (7 and 8) read
this rather than the Python.

Nothing here is a rule: the rules live in `phase-01-core.md`, steps 1.4 to 1.9.
These are shapes.

## Naming

**Message types and error codes stay `snake_case`.** They are identifiers the
contract cites by name — `not_host`, `hints_blocked`, `submit_answer`. Renaming
them would break every reference in `01-contract-to-preserve.md` silently.

**Field names are `camelCase`.** Today's protocol mixes both, sometimes inside
one message: `lobby_update` sends `isHost`, and a scoring breakdown sends
`timeBonus` beside `hint_penalty`. Both ends of the new stack are TypeScript and
both are being rewritten, so there is no compatibility to keep — only a
convention to stop guessing at.

**One concept, one name.** The topic of a round was `category` in `start_game`,
`theme` in `submit_theme` and `topic` in the round payload. It is `topic`
everywhere. `unlock_hint` sent a field called `number`; it is `falseInfoNumber`,
the name the solution already uses.

## Shapes that close something

| Change | What it closes |
|---|---|
| `game_start.players` has one shape, `{name, colour}` | D3 — the two start paths announce two shapes and the client accepts both |
| `game_start` is flat, no `data` envelope | It was the only message of fifteen to nest its payload |
| `hint_unlocked.grant` is a union on the level | C1.2 — a level-1 hint cannot carry the truth, and a level-2 reveal cannot arrive half-formed. Both become type errors rather than runtime checks |
| `scanner_result.paragraphIndex` is nullable | C1.6 — the SCANNER returns null when every fake is found; today the server sends nothing and the client cannot tell exhaustion from a lost frame |
| Item messages carry `itemId` alone | D8 — name and icon travelled beside it, hand-synchronised. They come from the catalogue of step 1.7 |
| `theme_selected.proposer` is nullable | It was the string `"Système"`: a magic value, and the last French string on the wire |
| `theme_selected` lost `loading` | It was always `true` |
| `items_distributed.wave` replaces `minute` | Waves are 30 seconds apart, so `minute` was simply wrong |
| `submit_answer` carries only `marked` | C1.3 — `hintsUsed`, `hintPenalty` and `scoreStolen` arrived from the client and were believed. Now they cannot be said at all |
| `start_game.topic` is required | The server accepted the message without one and asked the generator for `None`, which can only fail |
| `leaderboard` rows carry `player`, not `id` **and** `name` | They were always the same string |

## Values that are now bounded

- **`timeLimit` is 30 to 600 seconds**, the range the round picker already
  offers. The time bonus is `max(0, timeLimit − elapsed) × 0.5` (C2.1), so an
  unbounded limit is an unbounded score, and the current server takes any
  integer from the host. Refusing a change **mid-round** is a rule and belongs
  to step 1.8; refusing an absurd value at all is transport.
- **A hint level is 1 or 2, and nothing else.** The current server reads any
  level ≥ 2 as 2, which turns a client bug into a silent success.
- **A paragraph index is ≥ 1.** C3.3 makes the client contract 1-based, so 0 is
  not an off-by-one to grade but a message to refuse.

## Values that are deliberately tolerant

- **Cursor coordinates are clamped, not refused** (C5.5). A cursor outside
  `[0,1]` is a resized window, not an attack, and a player must not lose their
  connection over a stray pixel. Anything that is not a number becomes 0 — the
  same tolerance the handler had, moved into the schema.
- **An unknown message type is a rejection, not a crash** (C5.3). The union
  points at `type`, so a caller can tell "I do not know this message" from "this
  message is malformed".

## A regex that could not be transcribed

`validate_player_name` uses `^[\w\-. ]+$` with Python's `re.UNICODE`, where
`\w` matches `élise` and `日本`. JavaScript's `\w` is ASCII-only: copying the
regex across would have locked out every accented nickname, in silence, for a
game that reads `fr.wikipedia.org`. The new schema spells the class out as
`[\p{L}\p{N}_\-. ]`, and the test carries the accented cases.

## The REST surface

Nine routes, catalogued in `rest/routes.ts` with their schemas on each side.
The catalogue is compared to the `@router.get/post` decorators the way the
message catalogues are compared to the dispatch table — the other half of C8.1,
held from the new stack while both run.

**Solo and multiplayer are the same game through two transports**, so they share
the payloads rather than restating them. `POST /api/game/start` returns the same
`articleView` the round-start message carries, which is why the negative
assertion of C1.1 holds on both by construction rather than twice by hand. The
hint and scan responses are literally their WebSocket messages with `type`
removed.

**One score breakdown, not two.** The solo submission returns
`{tp, fp, hintsUsed, hintPenalty, scoreStolen, timeBonus}`; a multiplayer
leaderboard row returns the same thing **without** `scoreStolen`. A client
rendering a debrief had to know which mode produced it to know whether a field
exists. `scoreStolen` is simply 0 in solo — nobody is there to steal from you —
and an always-zero field costs less than a branch in every consumer.

**`check` is not carried over.** `POST /api/game/submit` returns a `check`
object beside the score: `correct_found`, `false_positives`, `missed`, and a
percentage also called `score` — two fields named `score` in one response,
meaning different things. Nothing reads it: the debrief recomposes itself from
the breakdown and the solution. Dropping it is `no dead code`, not a change of
behaviour.

**Closed unions where a language model answers.** `/api/flag-report` returns a
`verdict`, a `confidence` and a `recommendation` that come out of the model
through `json.loads`. Nothing checks the model answered with one of the five
values its own prompt lists, so a sixth would reach the client unnoticed. They
are enums now, and `confidence` is bounded to 0–100.

**`/api/health` keeps `commit` a string that is present even when empty.** Only
the platform provides it, so locally it is `""`. Optional would let the CI probe
read `undefined` and wait for a match that cannot come — C7.2 says this contract
must survive the migration or the deployment loop dies in silence. There is no
field for the API key, so there is nothing to leak.

## Three errors that had no code

C5.1 asks for typed rejections and the current server half-delivers: six errors
carry a `code`, three carry only a French sentence — an empty ballot on
`force_pick`, an unknown topic on `start_game`, and a round that could not
generate anything. A client cannot branch on prose. They are now
`no_theme_submitted`, `topic_not_found` and `generation_failed`.

The REST failures had the same problem, in the place a client is most likely to
branch: FastAPI answers `{"detail": "<a French sentence>"}`, so a 404 on a hint
is indistinguishable from a 404 on the session. They are now
`session_not_found`, `hint_not_found` and `room_capacity_reached`, and a failed
REST call carries `{code, message}` like everything else. Twelve codes, one
closed union, both transports.
