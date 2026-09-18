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

/**
 * How long a wait may take before it is a hang rather than a slow machine.
 *
 * **Eight seconds, and it was two.** Measured on 2026-09-11, after three CI
 * runs went red on diffs that touched no realtime code: every one of them was
 * this helper, timing out at 2.04s — the operation had not finished by the
 * ceiling, not failed.
 *
 * The same argument C.7 makes about frame budgets applies: *a threshold on a
 * shared runner measures the runner*. Nothing here asserts how fast the server
 * answered — a suite that wanted latency measured would say so — so the deadline
 * is only a failure mode, and it should be obviously longer than any legitimate
 * wait. A condition that is met early costs nothing either way: this polls every
 * 5ms and returns the moment it is true.
 *
 * `vitest.config.ts` raises `testTimeout` with it. Otherwise Vitest's own
 * five-second default fires first and reports "Test timed out in 5000ms",
 * losing the sentence that says *what* was being waited for.
 *
 * **And it is not raised a third time.** It has been reached at eight, twice,
 * and `10-test-debt.md` counts both: raising the number moved the failure
 * rather than removing it. What R.1 changed instead is the message — see
 * `Diagnosed` below.
 */
const TIMEOUT_MS = 8000;

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
 * What a wait was for, and what was true when it gave up — step R.1.
 *
 * A bare string says what the condition was supposed to become and nothing
 * about what it was. That is enough for a wait whose only failure mode is "the
 * server never answered", and it is not enough for the waits that have actually
 * failed here: five CI runs, three at a two-second deadline and two at eight,
 * all of them *"timed out waiting for the lobby to hold ada, bob"* on branches
 * that changed nothing the socket service reads
 * (`plans/current-state/10-test-debt.md`). A roster short by one is a slow
 * instance; an empty one is a subscription that was never made; and the message
 * could not tell them apart.
 *
 * So the sites that have failed carry a describer too, and pay for it only when
 * they fail — `saw` is called from the throw and nowhere else.
 *
 * **It replaces a `() => string` this file used to accept**, which three sites
 * used and all three used the same way: gluing what they saw onto the end of
 * what they wanted, in one sentence, in three different phrasings. Splitting the
 * two makes every failure here read alike, and makes the describer a thing a
 * site can be seen not to have.
 *
 * **Synchronous on purpose.** A describer that awaits can hang, and the one
 * thing worse than a timeout with no diagnosis is a timeout that never finishes
 * reporting. Read what is already in hand: the frames the client received, the
 * state the reducer last returned.
 */
export interface Diagnosed {
  /** The sentence a bare string would have been: what the wait was for. */
  readonly want: string;
  /** What was true at the deadline. Called once, from the failure path. */
  readonly saw: () => string;
}

/**
 * Describes the state at the deadline without letting the describer replace the
 * failure.
 *
 * A `saw` that throws is a describer reading state that is gone — a closed
 * socket, a truncated table — and a helper that let it propagate would report
 * that error instead of the timeout, which is the one fact the run needed.
 */
function describe(what: Diagnosed): string {
  try {
    return what.saw();
  } catch (error) {
    return `<describing the state threw: ${String(error)}>`;
  }
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
 * The failure names the time that actually passed and not the ceiling that was
 * set: a wait that gave up 40 ms over a two-second deadline is a slow machine,
 * and one that sat at eight seconds is a frame that was never coming — and the
 * two are told apart by the number, which is why it is in the message rather
 * than inferred from the ceiling the file happens to carry that month.
 *
 * @param timeoutMs raise it for a suite whose first request pays a warm-up:
 * BullMQ connects and loads its Lua scripts on the first alarm, which is seconds
 * once and milliseconds afterwards.
 */
export async function until(
  condition: () => boolean | Promise<boolean>,
  what: string | Diagnosed,
  timeoutMs = TIMEOUT_MS,
): Promise<void> {
  const started = Date.now();
  const deadline = started + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) {
      const waited = `${String(Date.now() - started)}ms`;
      throw new Error(
        typeof what === 'string'
          ? `timed out after ${waited} waiting for ${what}`
          : `timed out after ${waited} waiting for ${what.want}; saw ${describe(what)}`,
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
