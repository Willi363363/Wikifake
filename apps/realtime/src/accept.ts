// One socket, from the upgrade to the join — step Q.5.
//
// **Moved out of `server.ts`, which was at its 500-line cap with two steps
// still to write.** Squeezing the prose out of it was the other answer and it
// is the one the repository's rules call a defect; the code that decides what
// a socket may do is also the code this step has to wrap in a `try`, and it
// reads better where it is the subject of the file.
//
// Everything it needs is a parameter. That is what makes the ordering below
// readable without the service's whole lifecycle around it.
import { readFrame, CLOSE_MESSAGE_TOO_BIG } from './frames.js';
import { readHandshake } from './handshake.js';
import { createThrottle, type Intervals } from './throttle.js';
import type { Connection, Registry } from './connections.js';
import type { RoomStore } from './rooms/store.js';
import type { Scheduler } from './timers/scheduler.js';
import type { Subscriptions } from './subscriptions.js';
import type { ServiceOptions } from './service.js';
import type { ErrorCode } from '@wikifake/protocol';
import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';

export interface AcceptDependencies {
  readonly options: ServiceOptions;
  readonly connections: Registry;
  readonly subscriptions: Subscriptions;
  readonly scheduler: Scheduler;
  readonly settle: (
    roomCode: string,
    event: Parameters<RoomStore['apply']>[1],
  ) => Promise<void>;
  readonly track: <T>(work: Promise<T>) => Promise<T>;
  readonly intervals: Intervals;
  readonly graceSeconds: number;
  readonly now: () => number;
  /** A typed refusal, sent before the close so the client knows why (C5.1). */
  readonly refuse: (socket: WebSocket, code: ErrorCode, message: string) => void;
  /** A rejection the rules could not be asked about. */
  readonly apologise: (connection: Connection, code: ErrorCode) => void;
}

export function createAcceptor(
  deps: AcceptDependencies,
): (socket: WebSocket, request: IncomingMessage) => Promise<void> {
  const {
    options,
    connections,
    subscriptions,
    scheduler,
    settle,
    track,
    intervals,
    graceSeconds,
    now,
    refuse,
    apologise,
  } = deps;

  async function accept(socket: WebSocket, request: IncomingMessage): Promise<void> {
    const handshake = readHandshake(request.url ?? '/');
    if (!handshake.ok) {
      refuse(socket, handshake.code, handshake.message);
      return;
    }
    const { roomCode, playerName, token, ticket } = handshake.credentials;

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

    /**
     * Step O.2 — the departure, registered before anything is awaited.
     *
     * `close` used to be registered at the **end** of this function, after four
     * round trips and the settled join. A socket that closed inside that window
     * — a tab shut the moment it opened, against a Redis that answers in tens of
     * milliseconds — fired its `close` before anything was listening, and the
     * connection stayed in the registry for the life of the process: the
     * nickname locked against its own owner, and a roster holding a player who
     * would never be ready, so the round never started.
     *
     * Registered here instead. Nothing between `connections.add` above and this
     * line is awaited, so the event cannot be missed.
     *
     * **What it does is deferred, and that is the delicate half**: a `leave`
     * must not reach the room before the `join` it undoes, and at this point the
     * join is not on the chain yet. So the two booleans below carry the
     * ordering, and `depart` runs from whichever comes second — this handler, or
     * the join at the end. Neither can run it twice, because no `await`
     * separates either flag from the check beside it.
     */
    let joined = false;
    let departed = false;

    const depart = (): void => {
      // D5 — a dropped socket is not a departure. The player is marked away and
      // keeps everything; the window is what decides whether they were gone.
      //
      // The subscription goes last, so this instance is still listening when
      // the departure it caused comes back round — a room it still holds other
      // sockets for keeps hearing.
      void enqueue({ kind: 'leave', player: playerName })
        .then(() =>
          scheduler.arm(
            { roomCode, kind: 'grace', player: playerName },
            graceSeconds * 1000,
          ),
        )
        .finally(() => void subscriptions.stopListening(roomCode));
    };

    socket.on('close', () => {
      // The registry first, and unconditionally: a `leave` that broadcasts must
      // not try to send to the socket that has just gone, and a socket that
      // closed before its join must not keep its slot either way. This is the
      // half that was leaking.
      connections.remove(connection);
      departed = true;
      if (joined) depart();
    });

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

    /**
     * Step Q.5 — everything from here to the join, and what an exception in it
     * leaves behind.
     *
     * O.2 made a socket that **closed** before its join depart properly, with
     * two booleans carrying the order. Neither of them is set when one of the
     * four awaits below **throws**: `close` then runs with `joined` still
     * false, `depart` never runs, and the room keeps a player who never
     * readies — O.2's own symptom, reached by the other door.
     *
     * So the same cleanup is done by hand, in the order `depart` would have
     * done it, and the socket is refused rather than left open on a room it
     * never entered. `listening` is tracked because releasing a subscription
     * that was never taken would decrement somebody else's count.
     */
    let listening = false;
    try {
      // Listening before joining: a `lobby_update` published by this very join
      // has to find a subscription already in place, or the player misses
      // their own arrival.
      await subscriptions.listen(roomCode);
      listening = true;
      // D5 — they are back, so the window that would have evicted them is
      // dropped. Before the join rather than after: a grace alarm ringing
      // between the two would evict the player who has just reconnected.
      await scheduler.cancel(roomCode, 'grace', playerName);
      // Step E.3b.2 — who this is, decided here and never asked again. The
      // rules are handed an answer rather than a ticket: whether a signature
      // was real is a transport question, and a reducer that verified one
      // could not be replayed without the secret.
      //
      // After the token claim above on purpose: a socket that has not proved
      // it may hold this nickname has no business being attributed to an
      // account.
      const userId = options.accountFor?.({ roomCode, playerName, ticket }) ?? null;

      await enqueue({ kind: 'join', player: playerName, userId });
    } catch (error) {
      connections.remove(connection);
      if (listening) await subscriptions.stopListening(roomCode);
      // The nickname goes back, or the player cannot retry under their own
      // name until the room is reaped.
      await options.tokens.forget(roomCode, playerName).catch(() => undefined);
      // Rethrown rather than answered here: Q.2's `catch` is the one place
      // that tells a player their handshake failed, and two refusals would be
      // two error frames and two closes for one failure.
      throw error;
    }

    // Step O.2 — the join is on the chain, so a departure may now run behind it.
    // A socket that closed while the join was settling departs here; one that
    // closes later departs from the handler above.
    joined = true;
    if (departed) depart();
  }

  return accept;
}
