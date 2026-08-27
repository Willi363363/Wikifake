// D5 — the secret that says a returning player is the one who left.
//
// The client owns it. It generates one, keeps it for as long as the tab lives,
// and sends it on every connection including the first; nothing is minted
// server-side and no secret ever travels downwards, which is why the protocol
// grew no message for any of this.
//
// `sessionStorage`, not `localStorage`: "as long as the tab lives" is exactly
// what `sessionStorage` means. A token surviving in `localStorage` would let a
// tab opened tomorrow reclaim a seat in a room from last week — and, worse, two
// tabs would share one token and fight over the same nickname.

const KEY = 'wikifake.session-token';

/** The shape `apps/realtime` accepts: 16 to 128 of `[A-Za-z0-9_-]`. */
function mint(): string {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 48);
}

/**
 * This tab's token, minted on first use.
 *
 * Returns an empty string when there is no storage to keep it in — a private
 * window with storage disabled, or a server render. That is not a failure: a
 * connection with no token still plays, it simply cannot reclaim its nickname
 * afterwards, which is the fail-closed behaviour step 5.5 chose.
 */
export function sessionToken(): string {
  let store: Storage | undefined;
  try {
    store = globalThis.sessionStorage;
  } catch {
    return '';
  }
  if (store === undefined) return '';

  try {
    const held = store.getItem(KEY);
    if (held !== null && held !== '') return held;

    const fresh = mint();
    store.setItem(KEY, fresh);
    return fresh;
  } catch {
    // Storage that exists and refuses to be written to — Safari's private mode
    // has behaved this way. Playing without a token is better than not playing.
    return '';
  }
}
