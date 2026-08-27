<!-- Generated from the Zod schemas in packages/protocol. Do not edit. -->
<!-- Regenerate with: pnpm --filter @wikifake/protocol docs -->

# The protocol

Generated from `packages/protocol`, which is the single source of every
contract: one Zod schema per WebSocket message and per REST payload, and
the TypeScript types inferred from those schemas rather than declared
beside them.

A test compares these files to what the schemas produce, so a contract
that changes without its documentation fails CI (C8.2).

| Page | Contents |
|---|---|
| `websocket-client.md` | the thirteen messages a client may send |
| `websocket-server.md` | the fifteen messages the server sends |
| `rest.md` | the nine REST routes |

## Error codes

A closed union. Every rejection carries one, so a client can branch on it
rather than on prose (C5.1).

- `room_not_found`
- `invalid_name`
- `name_taken`
- `bad_json`
- `not_host`
- `hints_blocked`
- `no_theme_submitted`
- `topic_not_found`
- `generation_failed`
- `session_not_found`
- `hint_not_found`
- `room_capacity_reached`
- `invalid_target`
- `out_of_phase`
- `item_not_held`

## Item identifiers

A closed union too, which is what stops the client and the server from
holding different lists (D8). What each item does is in
`@wikifake/domain`; what it is called belongs to the interface.

- `HINT_LOCK`
- `FREEZE_TIME`
- `SCORE_STEAL`
- `SCANNER`
- `EARTHQUAKE`
- `BLACKOUT`
- `BLUR`
- `RICKROLL`
- `MIRROR`
- `TINY`
- `SPIN`
- `CONFETTI`
- `INVERT`
