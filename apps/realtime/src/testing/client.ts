// A test client that behaves like a browser, against a real server.
//
// The guarantees of C5 are all about what happens on the wire — a close code, a
// message arriving *before* a close, a connection that survives a bad frame — so
// they are tested against a real socket on a real port. A mocked handshake would
// prove the mock.
import { WebSocket } from 'ws';

export interface Opened {
  /** Every message the server sent, in order, as parsed objects. */
  readonly received: unknown[];
  /** The close code, once the socket has closed. */
  closedWith(): number | undefined;
  send(payload: unknown): void;
  /** Resolves once `count` messages have arrived, or rejects on a timeout. */
  waitForMessages(count: number): Promise<void>;
  /** Resolves once the socket has closed. */
  closed(): Promise<number>;
  close(): void;
}

const TIMEOUT_MS = 2000;

/**
 * Polls a condition rather than racing a fixed delay, which is how a suite
 * flakes.
 *
 * Exported because a test often waits on something the *server* did — a frame
 * reaching the handler — rather than on something it received. Sleeping for "long
 * enough" instead is the same bug with a slower failure.
 */
export async function until(condition: () => boolean, what: string): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/**
 * Opens a socket and starts recording.
 *
 * Resolves as soon as the socket opens **or** closes: a refused handshake closes
 * without ever opening, and a helper that only waited for `open` would hang on
 * exactly the cases C5.1 and C5.2 are about.
 */
export function open(
  port: number,
  path: string,
  headers: Record<string, string> = {},
): Promise<Opened> {
  const socket = new WebSocket(`ws://127.0.0.1:${String(port)}${path}`, { headers });
  const received: unknown[] = [];
  let closeCode: number | undefined;

  socket.on('message', (data: Buffer) => {
    received.push(JSON.parse(data.toString('utf8')));
  });
  socket.on('close', (code: number) => {
    closeCode = code;
  });

  const opened: Opened = {
    received,
    closedWith: () => closeCode,
    send: (payload) => {
      socket.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
    },
    waitForMessages: (count) =>
      until(() => received.length >= count, `${String(count)} message(s)`),
    closed: async () => {
      await until(() => closeCode !== undefined, 'the socket to close');
      return closeCode as number;
    },
    close: () => {
      socket.close();
    },
  };

  return new Promise((resolve, reject) => {
    const settle = (): void => {
      resolve(opened);
    };
    socket.once('open', settle);
    socket.once('close', settle);
    socket.once('error', (error: Error) => {
      // A refused upgrade arrives as an error, not a close: the server answered
      // 403 and there is no socket to close.
      if (closeCode === undefined) closeCode = 0;
      if (received.length === 0) reject(error);
    });
  });
}
