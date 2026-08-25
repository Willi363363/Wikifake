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
import {
  healthApi,
  type ErrorCode,
  type IncomingMessage as Incoming,
} from '@wikifake/protocol';
import { Hono } from 'hono';
import { WebSocketServer, type WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';

import { createRegistry, type Connection, type Registry } from './connections.js';
import { readFrame, CLOSE_MESSAGE_TOO_BIG, CLOSE_POLICY_VIOLATION } from './frames.js';
import { readHandshake } from './handshake.js';
import type { OriginPolicy } from './origins.js';

export interface ServiceOptions {
  readonly origins: OriginPolicy;
  /**
   * Whether this room exists. Injected: the room lives in Postgres since 4.8,
   * and a transport that opened a connection to `@wikifake/db` would be a
   * transport nobody can test without one.
   */
  roomExists(roomCode: string): Promise<boolean>;
  /**
   * What to do with a message the transport accepted.
   *
   * Receives a decoded message, never a frame: everything a frame can be other
   * than a message is a transport concern and is dealt with before this is
   * called. A handler that had to ask "was this readable" would be a second
   * place implementing C5.3.
   *
   * Step 5.2 plugs the reducer in here. It is a parameter rather than a `TODO`
   * because the seam is the point — the transport is finished before the rules
   * arrive, and stays finished.
   */
  onMessage?: (connection: Connection, message: Incoming) => void;
}

export interface Service {
  /** @param port 0 lets the OS choose, which is what a test wants. */
  listen(port: number): Promise<number>;
  close(): Promise<void>;
  /** The sockets this instance holds. Read by the tests, and by 5.3. */
  readonly connections: Registry;
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
          options.onMessage?.(connection, frame.message);
      }
    });

    socket.on('close', () => {
      connections.remove(connection);
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
