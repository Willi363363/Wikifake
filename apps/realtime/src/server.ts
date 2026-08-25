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
import type { RoomEffect } from '@wikifake/domain';
import { Hono } from 'hono';
import { WebSocketServer, type WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';

import { createRegistry, type Connection, type Registry } from './connections.js';
import { deliver } from './effects.js';
import { readFrame, CLOSE_MESSAGE_TOO_BIG, CLOSE_POLICY_VIOLATION } from './frames.js';
import { readHandshake } from './handshake.js';
import type { OriginPolicy } from './origins.js';
import type { RoomStore } from './rooms/store.js';

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
    const { roomCode, playerName } = handshake.credentials;

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

    const connection: Connection = {
      roomCode,
      playerName,
      send: (payload) => {
        socket.send(payload);
      },
      close: (code) => {
        socket.close(code);
      },
    };
    connections.add(connection);

    // Every event goes through the store: read, decide, commit. Nothing about
    // the room is remembered here between one frame and the next, which is what
    // makes a second instance safe.
    const settle = async (event: Parameters<RoomStore['apply']>[1]): Promise<void> => {
      try {
        const applied = await options.rooms.apply(roomCode, event);
        deliver(
          {
            connections,
            ...(options.onUnhandled === undefined
              ? {}
              : { onUnhandled: options.onUnhandled }),
          },
          roomCode,
          applied.effects,
        );
      } catch {
        apologise(connection, 'room_not_found');
      }
    };

    await settle({ kind: 'join', player: playerName });

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
          void settle({ kind: 'message', from: playerName, message: frame.message });
      }
    });

    socket.on('close', () => {
      connections.remove(connection);
      // The registry first: a `leave` that broadcasts must not try to send to
      // the socket that has just gone.
      void settle({ kind: 'leave', player: playerName });
    });
  }

  return {
    connections,

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

    close() {
      return new Promise((resolve, reject) => {
        // The sockets first: a Node server does not finish closing while a
        // connection is still open, so a suite that closed them in the other
        // order would hang rather than fail.
        for (const socket of sockets.clients) socket.terminate();
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
