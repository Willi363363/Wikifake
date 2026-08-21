/**
 * Enveloppe WebSocket.
 *
 * Remplace les `socket.onmessage = ...` reassignes a plusieurs endroits
 * (l'ancien lobby en definissait deux, le second ecrasant le premier).
 * Ici : un bus d'abonnements, une file d'envoi tant que le socket n'est pas
 * ouvert, et une fermeture volontaire distinguee d'une coupure.
 */

export function roomSocketUrl(code, playerName) {
  const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${window.location.host}/ws/${encodeURIComponent(
    code,
  )}/${encodeURIComponent(playerName)}`;
}

export function createRoomSocket({ code, playerName, onOpen, onClose }) {
  const socket = new WebSocket(roomSocketUrl(code, playerName));
  const listeners = new Set();
  const pending = [];
  let closedByUs = false;

  socket.addEventListener('open', () => {
    while (pending.length) socket.send(pending.shift());
    onOpen?.();
  });

  socket.addEventListener('message', (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    listeners.forEach((listener) => listener(message));
  });

  socket.addEventListener('close', () => {
    onClose?.({ intentional: closedByUs });
  });

  return {
    raw: socket,
    code,
    playerName,

    /** Abonnement ; retourne la fonction de desabonnement. */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Envoi typé. Les messages emis avant l'ouverture sont mis en file. */
    send(type, payload = {}) {
      const frame = JSON.stringify({ type, payload });
      if (socket.readyState === WebSocket.OPEN) socket.send(frame);
      else if (socket.readyState === WebSocket.CONNECTING) pending.push(frame);
    },

    get isOpen() {
      return socket.readyState === WebSocket.OPEN;
    },

    close() {
      closedByUs = true;
      listeners.clear();
      if (socket.readyState <= WebSocket.OPEN) socket.close(1000, 'client');
    },
  };
}
