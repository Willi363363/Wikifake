# Current state — the socket service (`apps/realtime`)

Node, Hono and `ws`. It serves `/ws/{room_code}/{player_name}`, `/ping` and
`/api/health`, and it is deployed separately from the web app because Vercel
does not host long-lived WebSockets.

**The protocol is not described here.** It is generated from the Zod schemas
into `plans/protocol/` — the message catalogues, their fields, the error codes
and the REST routes — and a test fails if the committed pages and the schemas
disagree. What follows is the *service*: how a frame becomes a decision, and
where the decision is kept.

## No instance holds the truth

That sentence is the design. Nothing in this service keeps a room between
calls — no cache, no `Map`, no memoised anything. Every event:

1. reads the room's state from Redis,
2. hands it to `reduceRoom` in `@wikifake/domain`, which is pure,
3. writes back what came out, **compare-and-set on a revision**,
4. performs the effects the reducer returned.

Step 3 is the one that earns its complexity. Two instances deciding on the same
room at the same moment both read revision 7; one commits 8, the other is told
7 is gone and decides again against 8. A read-modify-write without the compare
silently loses one of the two transitions, and the player who lost it sees a
score that never arrives.

The write is a Lua script (`rooms/scripts.ts`), so the compare and the swap are
one round trip and cannot interleave.

## From a frame to an effect

| Module | Role |
|---|---|
| `main.ts` | The only file that reads `process.env`, through `loadEnv`. Every collaborator is a parameter of `createService` |
| `server.ts` | The HTTP and upgrade surface: origins, handshake, frame size, `/ping`, `/api/health` |
| `handshake.ts` | Nickname and room validated **before** the socket is accepted |
| `frames.ts` | Decodes with `incomingMessage`. Invalid JSON → `bad_json`, connection kept. Unknown type → ignored |
| `throttle.ts` | Per-type rate limits, with `cursor` and `live_score` floored by the protocol's own constants |
| `rooms/store.ts` | Read, reduce, compare-and-set |
| `effects.ts` | Performs what the reducer decided: broadcast, send, arm or cancel a timer, generate, close |
| `bus.ts` | Redis pub/sub, one channel per room, so any instance reaches any socket |
| `subscriptions.ts` | Subscribes while a room has local sockets, and unsubscribes when the last one goes |
| `timers/` | BullMQ: round end, item waves, room TTL |
| `rooms/tokens.ts` | The session token a reconnection presents |
| `connections.ts` | Which sockets this instance happens to hold |
| `generation.ts` | The article, from `@wikifake/article`, off the event loop |

## What the transport refuses

Each of these is a clause of C5, and each cost a production bug in the old
stack:

- A nickname that is empty, over 24 characters or outside `^[\w\-. ]+$` — and
  the error message leaves **before** the close, so the player is told why.
- A nickname already held by a connected player in that room (`name_taken`),
  without touching the player already in place. It frees when their socket
  closes.
- Invalid JSON → `bad_json`, and **the connection survives**. A malformed frame
  used to be a disconnection.
- A frame beyond 64,000 characters → close 1009, without answering.
- A cursor outside `[0,1]`, a chat message over 400 characters, an empty chat
  message: refused by the schema, which is what the server validates with.
- A `cursor` or `live_score` flood: throttled server-side, so it is not
  rebroadcast to the room. The old server rebroadcast `live_score`
  unvalidated — an amplification vector (D6).
- A `use_item` targeting its caster, or naming more targets than the item has
  room for.
- A `time_limit` from the host once the round has started, which used to change
  the time bonus of later submissions.
- An origin that is not the app's. An empty allow-list accepts the app's own
  origin rather than everything, which fails closed.

## A dropped socket is not a player who left

The old stack deleted the player on disconnect, so score, items and paid hints
went with them and the nickname was immediately reclaimable by a third party
(D5). Here a disconnection marks the player disconnected and starts a grace
window; the session token in `rooms/tokens.ts` is what lets them come back into
the same seat, with what they had. The window is a timer like any other, so it
is tested with a fake clock rather than a real wait.

## A round ends because the server ends it

`time_limit` used to be applied by the client alone: if the last unsubmitted
player disconnected, the room stayed `playing` for ever, and there was no room
TTL either (D4). Now the round end is an armed BullMQ job, the item waves are
armed jobs, and an untouched room expires. `timers/arming.ts` is where a
reducer's `arm_timer` becomes one.

## Checking it

```bash
pnpm --filter @wikifake/realtime test   # 128 cases
```

The suite drives a real socket against a real service with Redis and Postgres
behind it — `testing/client.ts` is the test client. What it does **not** touch
is a model or Wikipedia: `WIKIPEDIA_API_URL` and `MODEL_BASE_URL` point at a
stub, which is configuration rather than a branch in the code.
