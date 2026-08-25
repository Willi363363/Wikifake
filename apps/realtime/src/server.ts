// The realtime service: an HTTP surface and the sockets that hang off it.
//
// Hono answers the probes Fly reads; `ws` owns the upgrade. They share one Node
// server because they share one port, which is what a platform gives you.
//
// Step 5.1 is the transport and nothing else: who may connect, what a frame is
// allowed to be, and what a refusal says. The room's state is not here and does
// not belong here — it moves to Redis in 5.2, and a `handle` that starts
// remembering things between frames is the drift this phase is written to avoid.
import { serve, type ServerType } from '@hono/node-server';
import { healthApi, type ErrorCode } from '@wikifake/protocol';
import {
  GRACE_SECONDS,
  ROOM_IDLE_LIMIT_SECONDS,
  type RoomEffect,
} from '@wikifake/domain';
import { Hono } from 'hono';
import { WebSocketServer, type WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';

import type { Bus, Unsubscribe } from './bus.js';
import { createRegistry, type Connection, type Registry } from './connections.js';
import { channelFor, deliverLocally, publish, readEnvelope } from './effects.js';
import { readFrame, CLOSE_MESSAGE_TOO_BIG, CLOSE_POLICY_VIOLATION } from './frames.js';
import { readHandshake } from './handshake.js';
import type { OriginPolicy } from './origins.js';
import type { RoomStore } from './rooms/store.js';
import type { TokenStore } from './rooms/tokens.js';
import { armFor } from './timers/arming.js';
import type { Alarm, OnAlarm, Scheduler } from './timers/scheduler.js';
import { drawWave, randomPick } from './timers/waves.js';

export interface ServiceOptions {
  readonly origins: OriginPolicy;
  /**
   * Whether this room exists. Injected: the room lives in Postgres since 4.8,
   * and a transport that opened a connection to `@wikifake/db` would be a
   * transport nobody can test without one.
   */
  roomExists(roomCode: string): Promise<boolean>;
  /**
   * Where the room's state lives. Redis, since 5.2 — never this process.
   *
   * Injected for the same reason as everything else here: a transport that
   * opened its own connection would be a transport nobody can test without one.
   */
  readonly rooms: RoomStore;
  /**
   * The channel every instance talks over. One per room.
   *
   * Since 5.3 nothing is sent straight to a socket: an effect is published, and
   * whichever instances hold sockets for that room deliver it. The publisher
   * hears its own messages, so delivery has exactly one path.
   */
  readonly bus: Bus;
  /** Keys and channels are namespaced so two deployments do not share rooms. */
  readonly namespace?: string;
  /** How much a socket may have queued before it is cut. Lowered by the tests. */
  readonly budgetBytes?: number;
  /**
   * D4 — what makes a round end when nobody ends it.
   *
   * A factory rather than an instance: what an alarm does is settle an event
   * against this service's own room, so the handler cannot exist before the
   * service does. Closing it is the service's job in return.
   */
  readonly scheduler: (onAlarm: OnAlarm) => Scheduler;
  /** How long a room with nothing happening in it survives. Shortened by tests. */
  readonly idleSeconds?: number;
  /** Which item a wave draws. Pinned by the tests; random in production. */
  readonly pick?: (upperBound: number) => number;
  /** D5 — who is entitled to reclaim a nickname whose socket dropped. */
  readonly tokens: TokenStore;
  /**
   * D5 — how long a dropped player keeps their seat, in seconds.
   *
   * Long enough for a lift, a tunnel or a laptop lid; short enough that a room
   * is not held by somebody who has closed the tab. Shortened by the tests.
   */
  readonly graceSeconds?: number;
  /**
   * Effects this service cannot carry yet — `generate_article` and the timers.
   *
   * Steps 5.3 and 5.4 take them. A callback rather than a silent drop, so the
   * gap is something a test can assert on rather than something a reader has to
   * notice.
   */
  onUnhandled?: (roomCode: string, effect: RoomEffect) => void;
}

export interface Service {
  /** @param port 0 lets the OS choose, which is what a test wants. */
  listen(port: number): Promise<number>;
  close(): Promise<void>;
  /** The sockets this instance holds. Read by the tests, and by 5.3. */
  readonly connections: Registry;
  /**
   * Settles an event that did not come from a socket.
   *
   * Two of the reducer's events arrive from outside the socket loop by design:
   * `article_ready` and `article_failed`, which answer the `generate_article`
   * effect. The pipeline that will send them is step 5.8; this is the door it
   * comes through, and it is the same door an alarm uses.
   */
  settle(roomCode: string, event: Parameters<RoomStore['apply']>[1]): Promise<void>;
}

/**
 * A rejection the rules could not be asked about.
 *
 * Reaching Redis can fail, and a player whose message vanished into a rejected
 * promise is a player watching a lobby that never updates. They are told, and
 * the socket survives — the same treatment a malformed frame gets.
 */
function apologise(connection: Connection, code: ErrorCode): void {
  connection.send(
    JSON.stringify({ type: 'error', code, message: 'The room could not be reached.' }),
  );
}

/** A typed refusal, sent before the close so the client knows why (C5.1). */
function refuse(socket: WebSocket, code: ErrorCode, message: string): void {
  socket.send(JSON.stringify({ type: 'error', code, message }));
  socket.close(CLOSE_POLICY_VIOLATION);
}

export function createService(options: ServiceOptions): Service {
  const connections = createRegistry();
  const namespace = options.namespace ?? 'wikifake:room';
  const idleSeconds = options.idleSeconds ?? ROOM_IDLE_LIMIT_SECONDS;
  const graceSeconds = options.graceSeconds ?? GRACE_SECONDS;
  const pick = options.pick ?? randomPick;

  const publisher = {
    bus: options.bus,
    namespace,
    ...(options.onUnhandled === undefined ? {} : { onUnhandled: options.onUnhandled }),
  };

  /**
   * Settles an event and carries out everything that follows from it.
   *
   * Publish first, arm second. The players see the transition as soon as it is
   * decided; the alarms it implies are Redis bookkeeping and nobody is waiting
   * on them.
   */
  async function settle(
    roomCode: string,
    event: Parameters<RoomStore['apply']>[1],
  ): Promise<void> {
    const applied = await options.rooms.apply(roomCode, event);
    await publish(publisher, roomCode, applied.effects);
    await armFor({ scheduler, idleSeconds }, roomCode, applied.state, applied.effects);
  }

  /**
   * What a fired alarm does.
   *
   * Each one becomes an event the reducer already understands, or — for an idle
   * room — nothing at all: there is nobody left to tell, the state has expired
   * with its key, and what is left to do is stop the other alarms ringing
   * against a room somebody may rebuild under the same code.
   */
  const ring: OnAlarm = (alarm: Alarm) => track(rang(alarm));

  async function rang(alarm: Alarm): Promise<void> {
    if (alarm.kind === 'room_idle') {
      await scheduler.cancel(alarm.roomCode, 'round_end');
      return;
    }

    // D5 — the grace window ran out. Now, and only now, is the player gone: the
    // round may end on it, the host may pass, and the room may close.
    if (alarm.kind === 'grace') {
      const player = alarm.player;
      if (player === undefined) return;

      await settle(alarm.roomCode, { kind: 'evict', player });
      // Their claim on the nickname goes with them. Left behind, it would keep
      // the slot locked for a player who is not coming back.
      await options.tokens.forget(alarm.roomCode, player);
      return;
    }

    if (alarm.kind === 'round_end') {
      await settle(alarm.roomCode, { kind: 'timer_expired' });
      return;
    }

    const wave = alarm.wave ?? 1;
    const held = await options.rooms.read(alarm.roomCode);
    // A wave for a round that is over is a wave nobody wants: the alarm outlived
    // its round, which `cancel_timer` normally prevents and a crash does not.
    if (held.state.phase !== 'round') return;

    await settle(alarm.roomCode, {
      kind: 'items_granted',
      wave,
      grants: drawWave(
        held.state.players.map((player) => player.name),
        wave,
        pick,
      ),
    });
  }

  const scheduler = options.scheduler(ring);

  /**
   * One subscription per room, however many sockets this instance holds for it.
   *
   * Counted rather than reference-free: subscribing twice would deliver twice,
   * and unsubscribing when the first of two players leaves would make the second
   * deaf. The count is of local sockets, so it says nothing about the room —
   * another instance may still be serving it.
   */
  const listening = new Map<string, { readonly stop: Unsubscribe; holders: number }>();

  /**
   * Work started and not yet finished.
   *
   * A departure is settled without anybody awaiting it — nothing should wait on
   * a player who has gone — which is right until the service is shutting down.
   * Then it is a write racing a closing connection, and it surfaces as an
   * unhandled rejection somewhere unrelated. `close` waits for these.
   */
  const inFlight = new Set<Promise<unknown>>();

  function track<T>(work: Promise<T>): Promise<T> {
    inFlight.add(work);
    void work.catch(() => undefined).finally(() => inFlight.delete(work));
    return work;
  }

  async function listen(roomCode: string): Promise<void> {
    const held = listening.get(roomCode);
    if (held !== undefined) {
      held.holders += 1;
      return;
    }

    // Claimed before the await, so two sockets arriving together do not both
    // open a subscription.
    const placeholder = { stop: async (): Promise<void> => undefined, holders: 1 };
    listening.set(roomCode, placeholder);

    const stop = await options.bus.subscribe(
      channelFor(namespace, roomCode),
      (payload) => {
        const envelope = readEnvelope(payload);
        // Only this service publishes here, so an envelope that does not parse
        // is a bug rather than an attack — and delivering `undefined` to every
        // socket in the room would be a worse way to find out.
        if (envelope !== null) {
          deliverLocally(
            {
              connections,
              ...(options.budgetBytes === undefined
                ? {}
                : { budgetBytes: options.budgetBytes }),
            },
            roomCode,
            envelope,
          );
        }
      },
    );

    listening.set(roomCode, { stop, holders: placeholder.holders });
  }

  async function stopListening(roomCode: string): Promise<void> {
    const held = listening.get(roomCode);
    if (held === undefined) return;

    held.holders -= 1;
    if (held.holders > 0) return;

    listening.delete(roomCode);
    await held.stop();
  }

  const app = new Hono();

  // C7.1 — the same literal the web app answers with. The platform's health
  // check reads it, and a service whose probe answers something else is a
  // service the platform decides is down.
  app.get('/ping', (context) =>
    context.json(healthApi.pingResponse.parse({ status: 'alive' })),
  );

  const sockets = new WebSocketServer({ noServer: true });
  let server: ServerType | undefined;

  sockets.on('connection', (socket: WebSocket, request: IncomingMessage) => {
    void accept(socket, request);
  });

  async function accept(socket: WebSocket, request: IncomingMessage): Promise<void> {
    const handshake = readHandshake(request.url ?? '/');
    if (!handshake.ok) {
      refuse(socket, handshake.code, handshake.message);
      return;
    }
    const { roomCode, playerName, token } = handshake.credentials;

    if (!(await options.roomExists(roomCode))) {
      refuse(socket, 'room_not_found', 'That room does not exist.');
      return;
    }

    // C5.2 — a connected homonym is refused, and the player already in place is
    // not touched: no state of theirs is read, written or replaced above.
    if (connections.holds(roomCode, playerName)) {
      refuse(socket, 'name_taken', `The nickname ${playerName} is already in use.`);
      return;
    }

    // D5 — and a homonym arriving while the rightful player is reconnecting is
    // refused too, on a claim they cannot satisfy. Without this, keeping a
    // dropped player's score and items would be a way to steal both.
    if (!(await options.tokens.claim(roomCode, playerName, token))) {
      refuse(socket, 'name_taken', `The nickname ${playerName} is already in use.`);
      return;
    }

    const connection: Connection = {
      roomCode,
      playerName,
      send: (payload) => {
        socket.send(payload);
      },
      close: (code) => {
        socket.close(code);
      },
      bufferedBytes: () => socket.bufferedAmount,
      terminate: () => {
        socket.terminate();
      },
    };
    connections.add(connection);

    /**
     * Every event for this socket, one after another.
     *
     * A chain rather than a set of independent promises, for two reasons. The
     * join has to settle before anything a player sends is decided against the
     * room — otherwise their first message is graded against a room they are not
     * in yet. And frames must not be **dropped** while it does: the message
     * handler is registered before the join is settled, so a client that sends
     * the moment its socket opens is queued rather than ignored.
     *
     * That was not hypothetical. With the handler registered after the join, a
     * suite whose first request paid a connection warm-up lost both of its
     * `set_ready` frames, and the room simply never became ready.
     */
    let queued: Promise<void> = Promise.resolve();

    const enqueue = (event: Parameters<RoomStore['apply']>[1]): Promise<void> => {
      queued = track(
        queued.then(async () => {
          try {
            await settle(roomCode, event);
          } catch {
            apologise(connection, 'room_not_found');
          }
        }),
      );
      return queued;
    };

    socket.on('message', (data: Buffer) => {
      const frame = readFrame(data.toString('utf8'));

      switch (frame.kind) {
        // C5.7 — closed without an answer. There is nothing to say to a flood,
        // and saying it would mean allocating a reply per oversized frame.
        case 'too_big':
          socket.close(CLOSE_MESSAGE_TOO_BIG);
          return;

        // C5.3 — the connection survives. A client that sent one bad frame is a
        // client that will send a good one next.
        case 'unreadable':
          connection.send(
            JSON.stringify({ type: 'error', code: 'bad_json', message: frame.detail }),
          );
          return;

        // C5.3 — a type this server does not handle: ignored, in silence, and
        // not passed on. Dropping it here rather than in the handler is what
        // keeps "ignored" a property of the transport.
        case 'unknown':
          return;

        case 'message':
          void enqueue({ kind: 'message', from: playerName, message: frame.message });
      }
    });

    // Listening before joining: a `lobby_update` published by this very join has
    // to find a subscription already in place, or the player misses their own
    // arrival.
    await listen(roomCode);
    // D5 — they are back, so the window that would have evicted them is dropped.
    // Before the join rather than after: a grace alarm ringing between the two
    // would evict the player who has just reconnected.
    await scheduler.cancel(roomCode, 'grace', playerName);
    await enqueue({ kind: 'join', player: playerName });

    socket.on('close', () => {
      // The registry first: a `leave` that broadcasts must not try to send to
      // the socket that has just gone. The subscription goes last, so this
      // instance is still listening when the departure it caused comes back
      // round — a room it still holds other sockets for keeps hearing.
      connections.remove(connection);
      // D5 — a dropped socket is not a departure. The player is marked away and
      // keeps everything; the window is what decides whether they were gone.
      void enqueue({ kind: 'leave', player: playerName })
        .then(() =>
          scheduler.arm(
            { roomCode, kind: 'grace', player: playerName },
            graceSeconds * 1000,
          ),
        )
        .finally(() => void stopListening(roomCode));
    });
  }

  return {
    connections,
    settle,

    listen(port) {
      return new Promise((resolve) => {
        server = serve({ fetch: app.fetch, port }, (address) => {
          resolve(address.port);
        });

        server.on('upgrade', (request, socket, head) => {
          // Refused before the upgrade: a socket that is opened and then closed
          // has already told the caller their origin reached us.
          if (!options.origins.accepts(request.headers.origin)) {
            socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
            socket.destroy();
            return;
          }

          sockets.handleUpgrade(request, socket, head, (opened) => {
            sockets.emit('connection', opened, request);
          });
        });
      });
    },

    async close() {
      // The scheduler first: a worker that rings mid-teardown would settle an
      // event against a store whose connection is on its way out.
      await scheduler.close();

      // Then the sockets, which is what produces the last round of departures,
      // and then those departures. Closing the subscriptions before them would
      // publish a `lobby_update` onto a channel nobody is listening to; closing
      // the connections before them would make the write fail on a closed
      // client, somewhere far from here.
      for (const socket of sockets.clients) socket.terminate();
      await Promise.allSettled([...inFlight]);

      for (const [, held] of listening) await held.stop();
      listening.clear();

      return new Promise((resolve, reject) => {
        sockets.close();

        if (server === undefined) {
          resolve();
          return;
        }
        server.close((error) => (error === undefined ? resolve() : reject(error)));
      });
    },
  };
}
