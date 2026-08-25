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
  /**
   * Stops taking anything off the wire, without closing.
   *
   * What a stalled player looks like from the server: the socket is open, the
   * kernel keeps acknowledging, and nothing is being read — so everything sent
   * queues on the server side. There is no other way to produce it, and the
   * step's criterion is about exactly this client.
   */
  pause(): void;
  resume(): void;
}

const TIMEOUT_MS = 2000;

/**
 * The TCP socket under the WebSocket.
 *
 * `ws` keeps it on an underscored property and offers no supported way to stop
 * reading — but "a client that has stopped reading" is the only thing the
 * backpressure criterion can be about, and mocking it would mock the very thing
 * under test.
 */
function raw(socket: WebSocket): { pause(): void; resume(): void } | undefined {
  return (socket as unknown as { _socket?: { pause(): void; resume(): void } })._socket;
}

/**
 * Polls a condition rather than racing a fixed delay, which is how a suite
 * flakes.
 *
 * Exported because a test often waits on something the *server* did — a frame
 * reaching the handler — rather than on something it received. Sleeping for "long
 * enough" instead is the same bug with a slower failure.
 *
 * The condition may be asynchronous — a test often waits on something only the
 * store can answer. Awaited rather than merely called: a promise is truthy, so a
 * condition returning one would satisfy every wait immediately and the test
 * would race whatever it was waiting for.
 *
 * @param timeoutMs raise it for a suite whose first request pays a warm-up:
 * BullMQ connects and loads its Lua scripts on the first alarm, which is seconds
 * once and milliseconds afterwards.
 */
export async function until(
  condition: () => boolean | Promise<boolean>,
  what: string | (() => string),
  timeoutMs = TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) {
      // Described lazily, so a failure can say what the state actually was
      // rather than only what it was supposed to become.
      throw new Error(
        `timed out waiting for ${typeof what === 'string' ? what : what()}`,
      );
    }
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
    pause: () => {
      raw(socket)?.pause();
    },
    resume: () => {
      raw(socket)?.resume();
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
