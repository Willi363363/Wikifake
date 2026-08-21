# Current state — the WebSocket protocol

`/ws/{room_code}/{player_name}`. The nickname is validated (length,
characters) and a nickname already used by a connected player is refused.

## Incoming messages

Incoming, handled in `realtime/handlers.py`:

`set_ready`, `get_lobby`, `force_start`, `submit_theme`, `force_pick`,
`start_game`, `live_score`, `cursor`, `chat_message`, `use_item`,
`unlock_hint`, `submit_answer`, `unsubmit_answer`.

## Host authorization

`force_start`, `force_pick` and `start_game` are **host-only**, verified
server-side (`Player.is_host`); other players receive
`{"type": "error", "code": "not_host"}`. Round options (duration, items) are
only applied if the sender is the host.

## Outgoing messages

Outgoing:

`lobby_update`, `theme_vote_start`, `theme_vote_update`, `theme_selected`,
`game_start`, `live_score_update`, `cursor_update`, `chat_message`,
`items_distributed`, `item_effect`, `item_used`, `hint_unlocked`,
`scanner_result`, `game_end`, `error`.

### Scoring

`src/scoring.py` is authoritative, for solo and multiplayer alike.

On the frontend, `features/game/useScore.js` **no longer computes
detections** — it has no way to, since it does not know the solution.
`finalStats` recomposes the debrief display from the scoring breakdown
returned by the server. `useLiveScore` remains an optimistic display during
the round: it deliberately counts every mark as correct, so that the solution
cannot be read from an opponent's score.
