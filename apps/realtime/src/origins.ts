// Which origins may open a socket.
//
// A pitfall the phase names on purpose: two hosting providers — the app on
// Vercel, this service on Fly — so the socket crosses an origin boundary that
// the current single-container deployment never had. Deciding it "later" means
// deciding it under pressure, with a broken preview deployment and a temptation
// to accept everything.
//
// The current server checks nothing at all, because everything was same-origin.
// A WebSocket is not protected by CORS: the browser sends the handshake whatever
// the origin, and only the server can refuse it. Accepting any origin would let
// any page open sockets against a room in a player's name.
export interface OriginPolicy {
  /** Whether a handshake carrying this `Origin` header may proceed. */
  accepts(origin: string | undefined): boolean;
  readonly allowed: readonly string[];
}

/** `https://a.example, https://b.example` — trimmed, empties dropped. */
export function parseOrigins(list: string): readonly string[] {
  return list
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '');
}

/**
 * Compares origins as origins, not as strings.
 *
 * `https://app.example` and `https://app.example/` are the same origin and
 * differ by a character; a string comparison would refuse one of them, and
 * whoever hit it would "fix" the configuration by widening the list.
 */
function normalise(origin: string): string | null {
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

/**
 * @param allowed the configured origins. An empty list refuses every
 * browser-issued handshake rather than accepting them all: a misconfiguration
 * that fails closed is one somebody notices.
 */
export function createOriginPolicy(allowed: readonly string[]): OriginPolicy {
  const permitted = new Set(
    allowed.map(normalise).filter((origin): origin is string => origin !== null),
  );

  return {
    allowed: [...permitted],

    accepts(origin) {
      // No `Origin` header at all: not a browser. A load-balancer probe, a
      // protocol test, a native client. Browsers always send one on a WebSocket
      // handshake, so its absence cannot be used to bypass the list.
      if (origin === undefined || origin === '') return true;

      const asked = normalise(origin);
      return asked !== null && permitted.has(asked);
    },
  };
}
