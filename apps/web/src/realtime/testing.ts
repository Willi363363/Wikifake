// A WebSocket the tests own.
//
// jsdom has no WebSocket, and mocking one is not a compromise here: what the
// provider does is decide *when* to open, *what* to do with a frame and *whether*
// to retry, and none of those need a real network. What does need one is the
// server's own suite, which is why `apps/realtime` opens real sockets on real
// ports and this does not.
import type { IncomingMessage, OutgoingMessage } from '@wikifake/protocol';

type Listener = (event: unknown) => void;

/** Every socket a test has opened, in order. */
export const opened: FakeSocket[] = [];

export class FakeSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = FakeSocket.CONNECTING;
  /** Everything the provider sent, parsed. */
  readonly sent: IncomingMessage[] = [];
  /** The code the provider closed with, if it did. */
  closedWith: number | null = null;

  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(readonly url: string) {
    opened.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const held = this.listeners.get(type) ?? new Set<Listener>();
    held.add(listener);
    this.listeners.set(type, held);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  send(payload: string): void {
    this.sent.push(JSON.parse(payload) as IncomingMessage);
  }

  close(code?: number): void {
    this.closedWith = code ?? 1000;
    this.readyState = FakeSocket.CLOSED;
  }

  // — what a test drives —

  /** The handshake succeeded. */
  accept(): void {
    this.readyState = FakeSocket.OPEN;
    this.emit('open', {});
  }

  /** The server said something. */
  deliver(message: OutgoingMessage): void {
    this.emit('message', { data: JSON.stringify(message) });
  }

  /** The server said something this client cannot read. */
  deliverRaw(data: string): void {
    this.emit('message', { data });
  }

  /** The socket went away. 1008 is a refusal; 1006 is the network. */
  drop(code: number, reason = ''): void {
    this.readyState = FakeSocket.CLOSED;
    this.emit('close', { code, reason });
  }

  private emit(type: string, event: Record<string, unknown>): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }
}

/** Installs the fake for one test file. Returns what to call afterwards. */
export function installFakeSocket(): () => void {
  const real = (globalThis as { WebSocket?: unknown }).WebSocket;
  (globalThis as { WebSocket?: unknown }).WebSocket = FakeSocket;
  opened.length = 0;
  return () => {
    (globalThis as { WebSocket?: unknown }).WebSocket = real;
    opened.length = 0;
  };
}
