/**
 * Room WebSocket helpers.
 *
 * The socket is owned by whoever opened it (the lobby) and then handed down
 * through the session. Consumers subscribe with `useSocketMessages` instead of
 * assigning `socket.onmessage`, so several features can listen at once.
 */
import { useEffect, useRef } from 'react';

/** Open the room socket, matching the page protocol (ws:// vs wss://). */
export function openRoomSocket(roomCode, playerName) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return new WebSocket(`${protocol}//${window.location.host}/ws/${roomCode}/${playerName}`);
}

/** Send a typed message. No-ops when the socket is closed, which is safe here. */
export function send(socket, type, payload = {}) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type, ...payload }));
}

/**
 * Subscribe to parsed messages for as long as the component is mounted.
 *
 * The handler is kept in a ref so callers can pass an inline closure over fresh
 * state without the listener being detached and re-attached on every render.
 */
export function useSocketMessages(socket, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket) return undefined;
    const onMessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      handlerRef.current?.(message);
    };
    socket.addEventListener('message', onMessage);
    return () => socket.removeEventListener('message', onMessage);
  }, [socket]);
}
