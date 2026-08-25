// The sockets this instance holds.
//
// Deliberately **per instance**, and deliberately not the room. A socket cannot
// be shared between processes — it is a file descriptor — so the registry of
// open sockets is the one thing that legitimately lives in memory here. The
// room's *state* does not, and moves to Redis in step 5.2; until then, a homonym
// is refused against the sockets this instance holds, which is what the current
// server does for everything.
//
// That distinction is the whole architecture of the phase, so it is worth being
// explicit about which half this file is.
export interface Connection {
  readonly roomCode: string;
  readonly playerName: string;
  send(payload: string): void;
  close(code: number): void;
  /**
   * How much this socket has queued and not yet flushed.
   *
   * The measure of a slow reader. `send` never blocks — it appends to a buffer —
   * so a player whose connection has stalled does not delay anybody, but the
   * buffer grows without bound until the process runs out of memory. This is
   * what step 5.3 spends against a budget.
   */
  bufferedBytes(): number;
  /** Cut it now, without waiting for a close handshake nobody is reading. */
  terminate(): void;
}

export interface Registry {
  /** Whether this instance already holds a live socket under that name. */
  holds(roomCode: string, playerName: string): boolean;
  add(connection: Connection): void;
  remove(connection: Connection): void;
  /** Every socket this instance holds for a room. */
  in(roomCode: string): readonly Connection[];
  readonly size: number;
}

/** A separator no nickname can contain: the schema allows no vertical bar. */
function keyOf(roomCode: string, playerName: string): string {
  return `${roomCode}|${playerName}`;
}

export function createRegistry(): Registry {
  const byName = new Map<string, Connection>();

  return {
    holds: (roomCode, playerName) => byName.has(keyOf(roomCode, playerName)),

    add(connection) {
      byName.set(keyOf(connection.roomCode, connection.playerName), connection);
    },

    remove(connection) {
      const key = keyOf(connection.roomCode, connection.playerName);
      // Only if it is still *this* socket. A reconnection that replaced the
      // entry must not be evicted by the old socket's close event arriving
      // afterwards — which is the ordering that makes a reconnected player
      // disappear a second later.
      if (byName.get(key) === connection) byName.delete(key);
    },

    in: (roomCode) =>
      [...byName.values()].filter((connection) => connection.roomCode === roomCode),

    get size() {
      return byName.size;
    },
  };
}
