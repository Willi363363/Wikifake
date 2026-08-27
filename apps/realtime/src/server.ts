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
import { GRACE_SECONDS, ROOM_IDLE_LIMIT_SECONDS } from '@wikifake/domain';
import { Hono } from 'hono';
import { WebSocketServer, type WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';

import { createRegistry, type Connection } from './connections.js';
import { deploymentIdentity } from './deployment.js';
import { publish } from './effects.js';
import { readFrame, CLOSE_MESSAGE_TOO_BIG, CLOSE_POLICY_VIOLATION } from './frames.js';
import { readHandshake } from './handshake.js';
import type { RoomStore } from './rooms/store.js';
import { createSubscriptions } from './subscriptions.js';
import type { RoundOutcome } from './generation.js';
import { createThrottle, DEFAULT_INTERVALS, type Intervals } from './throttle.js';
import { armFor } from './timers/arming.js';
import { createRinging } from './timers/ringing.js';
import type { Alarm, OnAlarm } from './timers/scheduler.js';
import { randomPick } from './timers/waves.js';

import type { Service, ServiceOptions } from './service.js';

// Re-exported so `service.js` is an implementation detail of this module's
// consumers rather than a second import they have to know about.
export type { Service, ServiceOptions };

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
  const now = options.now ?? ((): number => Date.now());
  const intervals: Intervals = { ...DEFAULT_INTERVALS, ...options.throttleMs };

  const publisher = { bus: options.bus, namespace };

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

    // C1.8 — last, and only once the room's own state is gone: the row is what
    // says the code exists, so forgetting it before the state would leave a
    // window where a room is joinable and unfindable.
    if (applied.effects.some((effect) => effect.kind === 'close_room')) {
      await options.closeRoom(roomCode);
    }

    // D3 — and the slow one, started and not waited for. Reading Wikipedia and
    // asking a model takes seconds; awaiting it here would hold up every other
    // message for this room, which is the very defect `generate_article` was
    // made an effect to avoid.
    for (const effect of applied.effects) {
      if (effect.kind === 'generate_article') {
        void track(produce(roomCode, effect.topic, applied.state));
      }
    }
  }

  /**
   * Turns a topic into a round, or into the next candidate's turn.
   *
   * The room is read from the state the decision was taken against, not read
   * back afterwards: the players and the time limit that go into the row are the
   * ones the round is being started for.
   */
  async function produce(
    roomCode: string,
    topic: string,
    decided: Awaited<ReturnType<RoomStore['apply']>>['state'],
  ): Promise<void> {
    // A generation that throws is a generation that failed, and the room has to
    // be told: nothing else will ever settle this one, and a room left in
    // `generating` waits for an article that is not coming — which is exactly
    // the state the current server gets stuck in.
    const outcome = await options.articles
      .open({
        roomCode,
        topic,
        timeLimit: decided.options.timeLimit,
        players: decided.players.map((player) => ({
          name: player.name,
          colour: player.colour,
        })),
      })
      .catch((): RoundOutcome => ({ ok: false }));

    await settle(
      roomCode,
      outcome.ok
        ? {
            kind: 'article_ready',
            article: outcome.article,
            solution: outcome.solution,
            // The round starts now, not when the topic was picked: the minutes
            // spent reading Wikipedia are not minutes anybody was playing.
            startedAt: now(),
          }
        : { kind: 'article_failed' },
    );
  }

  const ring: OnAlarm = (alarm: Alarm) =>
    track(
      createRinging({
        settle,
        rooms: options.rooms,
        tokens: options.tokens,
        closeRoom: options.closeRoom,
        pick,
        scheduler: () => scheduler,
      })(alarm),
    );

  const scheduler = options.scheduler(ring);

  const subscriptions = createSubscriptions({
    bus: options.bus,
    namespace,
    connections,
    ...(options.budgetBytes === undefined ? {} : { budgetBytes: options.budgetBytes }),
  });

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

  const app = new Hono();

  // C7.1 — the same literal the web app answers with. The platform's health
  // check reads it, and a service whose probe answers something else is a
  // service the platform decides is down.
  app.get('/ping', (context) =>
    context.json(healthApi.pingResponse.parse({ status: 'alive' })),
  );

  // C7.2 — the deployment identity `deploy-check.yml` reads. The web app
  // answers the same shape at the same path: the probe polls two URLs and
  // compares the same `commit` key, so one contract rather than two.
  app.get('/api/health', (context) =>
    context.json(healthApi.healthResponse.parse(deploymentIdentity())),
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
    // C5.5, D6 — one allowance per socket, so a flood costs its sender their own
    // frames and nobody else's.
    const throttle = createThrottle(intervals, Date.now);

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
          // C5.5, D6 — over the limit, and dropped where it stands: not
          // settled, not answered, not passed on. `cursor` and `live_score` are
          // the only two, and both are superseded by the next one anyway.
          if (!throttle.admits(frame.message)) return;

          void enqueue({
            kind: 'message',
            from: playerName,
            message: frame.message,
            // When it was sent, which is all the transport can know: how long
            // the round has been running is the reducer's arithmetic, against
            // the instant the round itself started.
            at: now(),
          });
      }
    });

    // Listening before joining: a `lobby_update` published by this very join has
    // to find a subscription already in place, or the player misses their own
    // arrival.
    await subscriptions.listen(roomCode);
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
        .finally(() => void subscriptions.stopListening(roomCode));
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

      await subscriptions.closeAll();

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
