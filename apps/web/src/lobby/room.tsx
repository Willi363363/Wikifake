'use client';

// The waiting room.
//
// Everything on screen comes from the server's last `lobby_update`: who is here,
// who is host, who is ready. Nothing is tallied locally, which is the difference
// between a screen that agrees with the server and a screen that usually agrees
// with the server.
//
// The two host settings are the exception, and it is a gap rather than a
// decision: `lobby_update` carries no room options, so the time limit and the
// items switch live in the host's browser and travel with `set_ready`. A guest
// cannot see the round they are about to play. Recorded in the step sheet — it
// wants a protocol change, and this is not the step for one.
import { DEFAULT_TIME_LIMIT_SECONDS } from '@wikifake/protocol';
import { Badge, Button, Separator } from '@wikifake/ui';
import { useState } from 'react';

import { HostSettings } from './host-settings.js';
import { PlayerList } from './player-list.js';
import { useRoom } from './use-room.js';
import { useRealtime } from '../realtime/provider.js';

export interface RoomProps {
  readonly roomCode: string;
  readonly nickname: string | null;
}

export function Room({ roomCode, nickname }: RoomProps) {
  const { status, refusal: transportRefusal } = useRealtime();
  const { send } = useRealtime();
  const room = useRoom(nickname);

  const [timeLimit, setTimeLimit] = useState(DEFAULT_TIME_LIMIT_SECONDS);
  const [withItems, setWithItems] = useState(true);

  const everyoneReady =
    room.players.length > 0 && room.players.every((player) => player.ready);

  /** The host's options ride with every `set_ready`, as the protocol allows. */
  const declare = (
    ready: boolean,
    options?: { timeLimit?: number; withItems?: boolean },
  ) => {
    room.clearRefusal();
    send({
      type: 'set_ready',
      ready,
      ...(room.isHost ? { timeLimit, withItems, ...options } : {}),
    });
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4 py-10">
      <header className="text-center">
        <p className="text-xs tracking-widest text-muted uppercase">Room</p>
        <h1 className="font-mono text-3xl tracking-[0.2em] text-ink">{roomCode}</h1>
        {status === 'open' ? null : (
          // Said plainly rather than hidden: a roster that has stopped updating
          // looks exactly like a room where nobody is doing anything.
          <p className="mt-2">
            <Badge tone={status === 'closed' ? 'danger' : 'warn'}>{status}</Badge>
          </p>
        )}
      </header>

      <div className="rounded-xl border border-line bg-surface p-6 shadow-md">
        <PlayerList players={room.players} />

        <Separator className="my-5" />

        {room.isHost ? (
          <div className="space-y-4">
            <HostSettings
              timeLimit={timeLimit}
              withItems={withItems}
              onTimeLimitChange={(seconds) => {
                setTimeLimit(seconds);
                declare(room.isReady, { timeLimit: seconds });
              }}
              onWithItemsChange={(next) => {
                setWithItems(next);
                declare(room.isReady, { withItems: next });
              }}
            />
            <Separator />
          </div>
        ) : (
          <p className="mb-4 text-center text-sm text-muted">
            Waiting for the host to start the round.
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2">
          <Button
            variant={room.isReady ? 'default' : 'primary'}
            size="lg"
            aria-pressed={room.isReady}
            onClick={() => {
              declare(!room.isReady);
            }}
          >
            {room.isReady ? 'Ready — cancel' : "I'm ready"}
          </Button>

          {room.isHost ? (
            <Button
              variant={everyoneReady ? 'primary' : 'ghost'}
              size="lg"
              onClick={() => {
                room.clearRefusal();
                send({ type: 'force_start', timeLimit, withItems });
              }}
            >
              {everyoneReady ? 'Start the round' : 'Start without waiting'}
            </Button>
          ) : null}
        </div>

        {room.refusal === null ? null : (
          // C1.7 — the server said no. It is displayed and it changes nothing:
          // the roster that arrives next is the truth. A guest whose client
          // sends a host-only message sees this rather than a dead screen.
          <p role="alert" className="mt-4 text-center text-sm text-danger">
            {room.refusal.message}
          </p>
        )}
        {transportRefusal === null ? null : (
          <p role="alert" className="mt-4 text-center text-sm text-danger">
            {transportRefusal}
          </p>
        )}
      </div>
    </main>
  );
}
