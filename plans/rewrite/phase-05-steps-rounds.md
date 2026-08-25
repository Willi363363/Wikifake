# Phase 5 — steps: how a round begins and ends

> Steps 5.4 and 5.8. The phase sheet, its exit gate and where each step stands:
> `phase-05-realtime.md`. What a player may do: `phase-05-steps-players.md`.
> The transport underneath: `phase-05-steps-transport.md`.

### 5.4 — BullMQ timers

Delayed jobs for round end by timeout, idle-room TTL and item waves. This
is what closes "the server never enforces the end of a round": today
`time_limit` is only enforced by the client.

Four decisions taken while writing it:

- **BullMQ is handed `ioredis`, a second Redis driver.** Not a preference:
  version 6 made `ioredis` optional and offers node-redis instead, but its
  **worker** does not process a job through one — armed alarms never ring and
  `close()` never settles. The supported client is the one that works.
- **The nine item waves are armed together, at fixed offsets**, rather than
  each arming its successor. BullMQ will not remove a running job, so an alarm
  re-arming its own id from inside its own handler is quietly ignored. The
  schedule is fixed anyway.
- **A job id cannot contain a colon** — it is what separates the parts of
  BullMQ's own keys — so alarms are keyed `A1B2C3-round_end`.
- **Every event for a socket is queued, in order.** The message handler is now
  registered *before* the join is settled: with it registered after, a client
  that sent the moment its socket opened had those frames dropped. Found by a
  test whose first request paid a connection warm-up, and it is a real defect
  rather than a test artefact.

**Done when**: a round whose last non-submitted player disconnects ends by
server-side timeout, and an idle room disappears when its TTL expires —
both verified by protocol tests.

### 5.8 — The article pipeline

`generate_article` is an effect the reducer emits and nothing in this service
answers, so a round cannot start: `article_ready` is the only way into one
(D3), and nobody sends it. The service already has the door — `settle`, the
same one an alarm uses — and `@wikifake/article` already has the chain. What is
missing is the piece between them: take the topic, produce a round or a
failure, and send back `article_ready` or `article_failed`.

This step was not in the original plan. It surfaced in 5.4, whose criterion
needs a round to exist, and is written down rather than absorbed into whichever
step noticed it last.

It also owns the **round clock**, which nothing supplied. The reducer took
`elapsedSeconds` as a parameter and the transport never stamped it, so every
message was decided as though the round had just begun: `HINT_LOCK` blocked its
target until second 20 of a clock stuck at 0 — for ever — and every time bonus
was computed on a full remaining limit. Found in 5.6, whose `FREEZE_TIME`
criterion reads a bonus rather than a block for that reason. It belongs here
because the instant a round starts is decided here, and nowhere else can know
it.

Six decisions taken while writing it:

- **The chain moved to `@wikifake/article`.** `sourceArticle` — cache, then
  Wikipedia, then the model — was in `apps/web`, and multiplayer needs exactly
  the same one. Two copies would be two answers to C3.7 and C4.5 with nothing
  making them agree. What stays in each application is what a failure is *called*
  there: an `ErrorCode` to a REST route, `article_failed` to a socket.
- **A multiplayer round writes a `game` row.** Not for the history, though it
  gets one: C4.6 counts a round's model calls in the numerator of
  `perGeneratedGame` and its round in the denominator, so a round that writes no
  row would silently inflate the cost per game on every multiplayer generation.
- **The message carries `at`, not `elapsedSeconds`.** The transport can stamp
  *when* a frame arrived without reading the room; it cannot know when the round
  started without reading it. The subtraction is the reducer's, against
  `round.startedAt`, which is a number in the state and therefore the same on
  every instance. Both fields are **required**: optional is how the clock came to
  be missing in the first place.
- **The round starts when the article is ready**, not when the topic was picked.
  The minutes spent reading Wikipedia and waiting on a model are not minutes
  anybody was playing.
- **A generation that throws is a generation that failed.** Nothing else will
  ever settle that one, and a room left in `generating` waits for an article that
  is not coming — which is precisely the state the current server gets stuck in.
- **The service takes a clock**, like it takes a draw. A test asserting a time
  bonus against the wall clock is a test asserting how fast the machine was.

Two things moved so that both applications could share them rather than own a
copy each: the round fixtures (`@wikifake/article/testing`) and the scratch test
database (`@wikifake/db/testing`). The second had already been called out as a
pattern on its third occurrence.

**Done when**: a topic voted for in a room produces a round over the socket,
with the model and Wikipedia mocked; a topic that yields no article falls
back to the next candidate and then to the lobby (C3.7); and a message settled
during a round carries the seconds elapsed since it started.
