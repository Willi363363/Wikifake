'use client';

// Who is in the room.
//
// Three changes from the current list, all of them about reading the server
// rather than guessing.
//
// The crown follows `isHost`, which `lobby_update` carries. The current one uses
// `i === 0` — the server's rule, reimplemented in a component. It agrees today,
// and it stops agreeing the first time somebody sorts the roster for display.
//
// The colour is `colour`. The current one reads `player.color`, which the
// protocol has never sent, so every dot falls back to grey.
//
// And a player whose socket dropped is shown as away rather than looking
// present. D5 keeps their seat for thirty seconds; a list that cannot say so is
// a list where a disconnection looks like silence.
import { Badge, cn } from '@wikifake/ui';

import type { RoomPlayer } from './use-room.js';

export function PlayerList({ players }: { players: readonly RoomPlayer[] }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold tracking-widest text-muted uppercase">
        Players ({players.length})
      </h2>
      <ul className="divide-y divide-line">
        {players.map((player) => (
          <li key={player.name} className="flex items-center justify-between gap-3 py-2">
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  'size-3 shrink-0 rounded-full',
                  !player.connected && 'opacity-40',
                )}
                style={{ backgroundColor: player.colour }}
              />
              <span
                className={cn(
                  'truncate text-sm text-ink',
                  !player.connected && 'text-muted',
                )}
              >
                {player.name}
              </span>
              {player.isHost ? <Badge tone="accent">host</Badge> : null}
            </span>

            <span className="shrink-0">
              {player.connected ? (
                <Badge tone={player.ready ? 'green' : 'neutral'}>
                  {player.ready ? 'ready' : 'waiting'}
                </Badge>
              ) : (
                // Not "gone": the seat is being kept, and saying "gone" would be
                // wrong for the thirty seconds that matter most.
                <Badge tone="warn">away</Badge>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
