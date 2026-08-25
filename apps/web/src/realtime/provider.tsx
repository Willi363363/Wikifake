'use client';

// The room connection, once, for everything below it.
//
// Today the socket is created by `useRoomConnection`, survives the round, and
// travels as `ws={socket}` from component to component — through the lobby, the
// player list, the chat, the session, the item panel. Every one of them has to
// know whether it is null yet, and none of them can be rendered without one.
//
// Here it is a context. Mounted in the layout of the `(game)` group, so a
// navigation from the lobby to the round is a navigation *inside* the provider
// and the socket is never reopened — which is the pitfall this phase names: a
// provider mounted too low makes every screen reconnect, and the server sees
// ghost reconnections it cannot tell from a flapping network.
import { decode, outgoingMessage } from '@wikifake/protocol';
import type { IncomingMessage, OutgoingMessage } from '@wikifake/protocol';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { socketUrl } from './endpoint.js';
import { sessionToken } from './token.js';

export type ConnectionStatus =
  /** No room to be in. The provider is mounted and idle. */
  | 'idle'
  | 'connecting'
  | 'open'
  /** Dropped, and coming back. D5's grace window is what makes this survivable. */
  | 'reconnecting'
  /** Refused, or closed on purpose. Nothing is retried. */
  | 'closed';

export interface Realtime {
  readonly status: ConnectionStatus;
  /** Why the connection ended, when the server said. */
  readonly refusal: string | null;
  /** Sends a message. Silently dropped while the socket is not open. */
  send(message: IncomingMessage): void;
  /** Subscribes for as long as the caller is mounted. */
  subscribe(listener: (message: OutgoingMessage) => void): () => void;
}

const RealtimeContext = createContext<Realtime | null>(null);

/**
 * How long before a dropped socket is retried, in milliseconds.
 *
 * Comfortably inside the server's thirty-second grace window, so a player who
 * loses their connection is back before their seat is given away — and long
 * enough that a server refusing every attempt is not hammered.
 */
const RETRY_MS = 1000;

/** RFC 6455: a deliberate close, and the server's "you may not". */
const CLOSE_NORMAL = 1000;
const CLOSE_POLICY_VIOLATION = 1008;

export interface RealtimeProviderProps {
  /** Null until the player has a room. The provider stays mounted regardless. */
  readonly roomCode: string | null;
  readonly playerName: string | null;
  readonly children: ReactNode;
}

export function RealtimeProvider({
  roomCode,
  playerName,
  children,
}: RealtimeProviderProps) {
  const socket = useRef<WebSocket | null>(null);
  const listeners = useRef(new Set<(message: OutgoingMessage) => void>());
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [refusal, setRefusal] = useState<string | null>(null);

  useEffect(() => {
    if (roomCode === null || playerName === null) {
      setStatus('idle');
      return undefined;
    }

    // Closed over by the retry below, so a reconnection uses the same token —
    // which is the whole of what lets the server give the seat back.
    const token = sessionToken();
    let live = true;
    let attempts = 0;

    const open = (): void => {
      if (!live) return;
      setStatus(attempts === 0 ? 'connecting' : 'reconnecting');
      attempts += 1;

      const opened = new WebSocket(
        socketUrl(globalThis.location.origin, roomCode, playerName, token),
      );
      socket.current = opened;

      opened.addEventListener('open', () => {
        if (!live) return;
        setStatus('open');
        setRefusal(null);
      });

      opened.addEventListener('message', (event: MessageEvent<string>) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(event.data);
        } catch {
          // C5.3's mirror image: the server is not supposed to send us rubbish,
          // and if it does, one bad frame must not take the room down.
          return;
        }

        const message = decode(outgoingMessage, parsed);
        // A type this client does not know yet is dropped in silence, for the
        // same reason the server drops one it does not know: a client one
        // version behind should keep playing.
        if (!message.ok) return;

        // A copy, because a listener may unsubscribe while being called.
        for (const listener of [...listeners.current]) listener(message.value);
      });

      opened.addEventListener('close', (event: CloseEvent) => {
        if (!live) return;
        socket.current = null;

        // A refusal is final. The server said `name_taken`, `room_not_found` or
        // `invalid_name` and closed; retrying would produce the same answer
        // forever, and the message it sent first is what the player needs to
        // read.
        if (event.code === CLOSE_POLICY_VIOLATION || event.code === CLOSE_NORMAL) {
          setStatus('closed');
          if (event.reason !== '') setRefusal(event.reason);
          return;
        }

        setStatus('reconnecting');
        retry.current = setTimeout(open, RETRY_MS);
      });
    };

    open();

    return () => {
      live = false;
      if (retry.current !== null) clearTimeout(retry.current);
      retry.current = null;
      // 1000: a deliberate departure, so the server settles a `leave` rather
      // than waiting on a socket that is not coming back.
      socket.current?.close(CLOSE_NORMAL);
      socket.current = null;
    };
  }, [roomCode, playerName]);

  const send = useCallback((message: IncomingMessage) => {
    const open = socket.current;
    // Dropped rather than queued: every message this client sends is about the
    // room as it is now, and a `set_ready` delivered after a reconnection is a
    // `set_ready` about a room that has moved on.
    if (open === null || open.readyState !== WebSocket.OPEN) return;
    open.send(JSON.stringify(message));
  }, []);

  const subscribe = useCallback((listener: (message: OutgoingMessage) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo<Realtime>(
    () => ({ status, refusal, send, subscribe }),
    [status, refusal, send, subscribe],
  );

  return <RealtimeContext value={value}>{children}</RealtimeContext>;
}

/** The connection. Throws outside the provider, which is a wiring bug. */
export function useRealtime(): Realtime {
  const held = useContext(RealtimeContext);
  if (held === null) {
    throw new Error('useRealtime must be used inside a RealtimeProvider');
  }
  return held;
}

/**
 * Subscribes to the room's messages for as long as the caller is mounted.
 *
 * The handler is kept in a ref, so a caller may pass an inline closure over
 * fresh state without the subscription being torn down and rebuilt on every
 * render — which is how a message arrives between the two and is lost.
 */
export function useRealtimeMessages(handler: (message: OutgoingMessage) => void): void {
  const { subscribe } = useRealtime();
  const held = useRef(handler);
  held.current = handler;

  useEffect(
    () =>
      subscribe((message) => {
        held.current(message);
      }),
    [subscribe],
  );
}
