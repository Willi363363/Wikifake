/**
 * Owns the room WebSocket's lifecycle.
 *
 * The socket outlives the lobby — it is handed to the round and comes back
 * when the round ends — so it is created here but never closed here.
 */
import { useState, useRef, useCallback } from 'react';
import { openRoomSocket } from '../../lib/ws.js';

export function useRoomConnection(initialSocket, { onOpen, onClose }) {
  const [socket, setSocket] = useState(initialSocket || null);

  // Kept in refs so `connect` stays stable across renders.
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  onOpenRef.current = onOpen;
  onCloseRef.current = onClose;

  const connect = useCallback((roomCode, playerName) => {
    const ws = openRoomSocket(roomCode, playerName);
    ws.addEventListener('open', () => {
      setSocket(ws);
      onOpenRef.current?.(ws);
    });
    ws.addEventListener('close', () => onCloseRef.current?.());
    return ws;
  }, []);

  return { socket, connect };
}
