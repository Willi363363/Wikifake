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
import { useEffect, useState } from 'react';

import { GenerationScreen } from './generation.js';
import { HostSettings } from './host-settings.js';
import { PlayerList } from './player-list.js';
import { ThemeVote } from './theme-vote.js';
import { useRoom } from './use-room.js';
import { useRoomHints } from './room-hints.js';
import { useRoomItems } from './room-items.js';
import { useRealtime } from '../realtime/provider.js';
import { Round } from '../round/round.js';

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

  // Keyed on the round rather than on how many falsifications it has: two
  // consecutive rounds with the same count would otherwise share a ledger, which
  // is what the current hook does and only survives because the round unmounts.
  // `lobby_update` carries no round id, so the topic and the count are the
  // closest thing to one — recorded in the step sheet as wanting a protocol
  // field.
  const roundKey =
    room.round === null
      ? ''
      : `${room.round.article.topic}:${String(room.round.article.totalFakes)}`;
  const hints = useRoomHints(roundKey);
  const items = useRoomItems(roundKey);

  const everyoneReady =
    room.players.length > 0 && room.players.every((player) => player.ready);

  // Whether the player has been handed over to the round. The generation screen
  // sets it when its bar has finished, and a new generation clears it.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (room.phase === 'generating') setEntered(false);
  }, [room.phase]);

  const generating = room.phase === 'generating' || (room.phase === 'round' && !entered);

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

  // The round is a screen, not a card in the lobby's column: it takes the page.
  // The same round solo renders — what differs is the transport. "You have
  // submitted" is the server's `answered` on the roster rather than a flag this
  // screen sets, which is the rule `hasVoted` follows and for the same reason.
  if (room.phase === 'round' && entered && room.round !== null) {
    return (
      <Round
        article={room.round.article}
        timeLimit={room.round.timeLimit}
        submitted={room.me?.answered ?? false}
        // Nothing is in flight over a socket: the answer is sent, and the roster
        // that comes back is the acknowledgement.
        busy={false}
        refusal={room.refusal?.message ?? null}
        hints={hints}
        items={items}
        effects={items.effects}
        // Everyone but this player, and the server refuses the caster anyway
        // (D6). Both, because a client that offers an illegal move is a client
        // that spends the player's item on a refusal.
        rivals={room.players
          .filter((player) => player.name !== nickname)
          .map((player) => player.name)}
        onSubmit={(marked) => {
          room.clearRefusal();
          send({ type: 'submit_answer', marked: [...marked] });
        }}
        onUnsubmit={() => {
          room.clearRefusal();
          send({ type: 'unsubmit_answer' });
        }}
        onUnlockHint={hints.unlock}
        onUseItem={(item, targets, marked) => {
          items.clearRefusal();
          items.use(item.instanceId, targets, marked);
        }}
      />
    );
  }

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

      {room.phase === 'voting' ? (
        <ThemeVote
          vote={room.vote}
          hasVoted={room.hasVoted}
          isHost={room.isHost}
          onPropose={(topic) => {
            room.clearRefusal();
            send({ type: 'submit_theme', topic });
          }}
          onForcePick={() => {
            room.clearRefusal();
            send({ type: 'force_pick' });
          }}
        />
      ) : null}

      {/*
        The generation screen outlives the arrival of the round on purpose: it
        stays until it says it is done, so the bar is seen to fill. That is what
        replaces the imperative handle — the screen decides when it is finished,
        rather than the lobby reaching in to finish it.
      */}
      {generating ? (
        <GenerationScreen
          topic={room.elected?.topic ?? ''}
          proposer={room.elected?.proposer ?? null}
          ready={room.phase === 'round'}
          onEnter={() => {
            setEntered(true);
          }}
        />
      ) : null}

      {room.phase !== 'lobby' ? null : (
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
      )}
    </main>
  );
}
