# Phase 9 — the socket service, verified live

Satellite of `phase-09-observability-and-cicd.md`, step 9.8. What the deployed
service was actually made to do, over the wire, rather than in a test runner.

`apps/realtime` had never run anywhere but a laptop until this. The multiplayer
half of the game — the whole reason there are two applications and two hosts —
was code nobody had watched work in production.

## The round

A four-player round, played against `wikifake-realtime.onrender.com`:

```
room created   POST /api/multiplayer/create   → a room code
roster         alice (host), bob, carol, dave
game_start     received by all four
               100 paragraphs · totalFakes 4
               no explanation, no positions, no solution in the payload
```

The last line is the contract's most expensive guarantee. It held on the
multiplayer path, as it does on the solo one.

## Eight transport guarantees, exercised against production

| Exercised | Answer |
|---|---|
| duplicate nickname | `name_taken` |
| unknown room | `room_not_found` |
| foreign WebSocket origin | 403, before the upgrade |
| abrupt drop | seat held — roster reads `alice(disconnected)` |
| reconnect with the same token | seat returned |
| reconnect **without** the token | refused |
| `start_game` from a non-host | `not_host` |
| `/api/health` | the deployed commit, equal to `main` |

Two of those pairs are the guarantees worth naming. **D5** is the fifth and
sixth rows read together: a dropped player keeps their seat, and *only they* can
reclaim it — a stranger arriving on the same nickname is refused. **C1.7** is the
seventh: authority to start a round belongs to the host and to nobody else, and
the server says so rather than trusting the client.

## The trap, for whoever probes this next

Three of those results first looked like defects of the service and were defects
of the probe. Two are worth writing down:

**Render takes about twenty seconds to propagate an abrupt disconnection.** A
reconnection probe that drops a socket and reconnects four seconds later finds
the player still `connected` server-side, and is correctly refused with
`name_taken` — which reads exactly like a broken grace window. It is not. That
latency is why `REALTIME_GRACE_SECONDS` is **90** on this host while the domain's
`GRACE_SECONDS` stays at 30: the contract's number is not a deployment's number.

**The host is the first socket to join, not the nickname that created the room.**
Opening four connections concurrently makes the host whichever one wins the race,
and `start_game` from any other is refused with `not_host`. Join sequentially, or
read the roster and ask the player it marks.

Also: the outbound message is `game_start`. There is no `round_started` — a probe
waiting for that name waits for ever while the round plays out perfectly.

## What this does not cover

The round was started, not finished. Scoring, item effects, the hint economy and
the debrief were exercised by the browser journeys in CI, not against this
deployment. And the free tier sleeps after fifteen minutes without traffic, so
the first connection of a session pays about a minute of cold start — during play
the socket traffic keeps it awake, which is the property that makes the free plan
usable at all.
