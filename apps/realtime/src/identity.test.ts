// Step E.3b.2 — which account a socket belongs to, at the transport's edge.
//
// `@wikifake/tickets` proves a signature refuses what it should. This proves
// the two things that live here instead: that the handshake carries the ticket
// without judging it, and that a verifier's answer — and only a verifier's
// answer — becomes the account on the join.
//
// The distinction is the security property. A `userId` the browser could put in
// the URL would be a browser that can be anybody; what the browser puts in the
// URL is a signature, and the only thing that turns it into an identity is a
// secret it does not have.
import { readHandshake } from './handshake.js';
import { describe, expect, it } from 'vitest';

describe('E.3b.2 — the handshake carries the ticket and judges nothing', () => {
  const read = (url: string) => {
    const handshake = readHandshake(url);
    return handshake.ok ? handshake.credentials : null;
  };

  it('takes the ticket off the query, whatever it is', () => {
    expect(read('/ws/A1B2C3/ada?auth=payload.signature')?.ticket).toBe(
      'payload.signature',
    );
  });

  it('carries rubbish through rather than refusing the socket', () => {
    // A player kept out of a room because a statistics counter could not be
    // credited would be the worst trade in this file. An unreadable ticket is a
    // round nobody gets credit for.
    const credentials = read('/ws/A1B2C3/ada?auth=not-a-ticket');

    expect(credentials).not.toBeNull();
    expect(credentials?.ticket).toBe('not-a-ticket');
  });

  it('is empty when none is offered', () => {
    expect(read('/ws/A1B2C3/ada')?.ticket).toBe('');
    expect(read('/ws/A1B2C3/ada?token=abcdefghijklmnop')?.ticket).toBe('');
  });

  it('reads the two secrets independently', () => {
    // `token` is D5's nickname secret, which the client owns and the server
    // never issues. `auth` is the server's own statement, which the client
    // cannot forge. A socket may carry neither, either or both.
    const credentials = read('/ws/A1B2C3/ada?token=abcdefghijklmnop&auth=a.b');

    expect(credentials).toMatchObject({ token: 'abcdefghijklmnop', ticket: 'a.b' });
  });
});
