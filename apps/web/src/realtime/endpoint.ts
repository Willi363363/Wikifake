// Where the realtime service is, from the browser.
//
// The current game connects to `window.location.host`: one origin, because a
// Vite proxy forwards `/ws` to the Python backend. The rewrite deploys the two
// separately — the app on Vercel, the socket service on Fly — so the address is
// a deployment fact and has to be configured.
//
// `NEXT_PUBLIC_REALTIME_URL` is read rather than `loadEnv()`: this runs in a
// browser, where there is no `process.env` to validate. Next inlines the literal
// at build time, which is also why it cannot be looked up dynamically.

/** The variable, if the deployment set one. Empty means "the page's own host". */
const CONFIGURED = process.env['NEXT_PUBLIC_REALTIME_URL'] ?? '';

/**
 * The socket URL for one player in one room.
 *
 * The nickname is **encoded**. The server's own schema allows spaces and
 * accented letters, and the current client interpolates the raw name into the
 * path — so "Jean Dupont" either fails to connect or arrives mangled. That is
 * bug 2.1.10, and it is fixed here because this is the only place a socket URL
 * is built.
 *
 * @param origin where the page itself is, so a deployment that serves both from
 * one host needs no configuration at all.
 */
export function socketUrl(
  origin: string,
  roomCode: string,
  playerName: string,
  token: string,
): string {
  const base = CONFIGURED === '' ? origin : CONFIGURED;
  // `ws:` for `http:`, `wss:` for `https:`. A configured URL may already say so.
  const url = new URL(base);
  url.protocol = url.protocol === 'https:' || url.protocol === 'wss:' ? 'wss:' : 'ws:';
  url.pathname = `/ws/${encodeURIComponent(roomCode)}/${encodeURIComponent(playerName)}`;
  url.search = token === '' ? '' : `?token=${encodeURIComponent(token)}`;
  return url.toString();
}
