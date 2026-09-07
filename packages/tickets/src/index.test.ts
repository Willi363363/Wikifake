// The ticket, and every way it must refuse — step E.3b.2.
//
// This is the only thing standing between "a socket says who it is" and
// "anybody can say they are anybody", so the cases below are mostly negative on
// purpose: what a signature is worth is entirely what it refuses.
import { describe, expect, it } from 'vitest';

import { mintTicket, readTicket, TICKET_TTL_MS } from './index.js';

// Named as the fixtures they are. `checks.sh` refuses a hardcoded secret unless
// the line says it is not one, which is the right rule and the reason
// `auth/guests.test.ts` spells its own the same way.
const SECRET = 'a-fake-test-signing-secret-32-chars-min';
const NOW = 1_800_000_000_000;

const TICKET = { userId: 'ada-account', roomCode: 'A1B2C3', playerName: 'ada' };
const AT = { roomCode: TICKET.roomCode, playerName: TICKET.playerName };

describe('E.3b.2 — a ticket the same secret signed', () => {
  it('reads back what was put in it', () => {
    const value = mintTicket(SECRET, TICKET, NOW);

    expect(readTicket(SECRET, value, AT, NOW)).toEqual(TICKET);
  });

  it('survives a query string without escaping', () => {
    // base64url on both halves, so nothing in it needs encoding and nothing a
    // log writes down will mangle it.
    const value = mintTicket(SECRET, TICKET, NOW);

    expect(value).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(value)).toBe(value);
  });
});

describe('E.3b.2 — and every way it is not one', () => {
  it('refuses a signature from another secret', () => {
    // The whole point. Without this, `userId` is a field a browser fills in.
    const forged = mintTicket('a-fake-test-signing-secret-that-differs', TICKET, NOW);

    expect(readTicket(SECRET, forged, AT, NOW)).toBeNull();
  });

  it('refuses a payload edited after signing', () => {
    const value = mintTicket(SECRET, TICKET, NOW);
    const [, signature] = value.split('.') as [string, string];
    const edited = Buffer.from(
      JSON.stringify({ ...TICKET, exp: NOW + TICKET_TTL_MS, userId: 'somebody-else' }),
      'utf8',
    ).toString('base64url');

    expect(readTicket(SECRET, `${edited}.${signature}`, AT, NOW)).toBeNull();
  });

  it('refuses one that has expired', () => {
    const value = mintTicket(SECRET, TICKET, NOW);

    expect(readTicket(SECRET, value, AT, NOW + TICKET_TTL_MS - 1)).toEqual(TICKET);
    expect(readTicket(SECRET, value, AT, NOW + TICKET_TTL_MS)).toBeNull();
  });

  it('refuses one minted for another room', () => {
    // Bound, so a ticket cannot be lifted out of a room somebody was invited to
    // and replayed into one they were not.
    const value = mintTicket(SECRET, TICKET, NOW);

    expect(readTicket(SECRET, value, { ...AT, roomCode: 'Z9Y8X7' }, NOW)).toBeNull();
  });

  it('refuses one minted for another nickname', () => {
    // The second half of the binding. A nickname is already defended by D5's
    // own token, so using a stolen ticket means holding both secrets and
    // joining the same room under the same name.
    const value = mintTicket(SECRET, TICKET, NOW);

    expect(readTicket(SECRET, value, { ...AT, playerName: 'bob' }, NOW)).toBeNull();
  });

  it.each([
    ['nothing at all', ''],
    ['one part', 'just-a-payload'],
    ['three parts', 'a.b.c'],
    ['a payload that is not JSON', `${Buffer.from('not json').toString('base64url')}.x`],
  ])('refuses %s', (_what, value) => {
    // One answer for every failure, because the caller does the same thing in
    // every case: play the round unattributed. A reason here would be a hint to
    // whoever is guessing.
    expect(readTicket(SECRET, value, AT, NOW)).toBeNull();
  });

  it('refuses a signed payload with no user in it', () => {
    // Signed by us, and still not a ticket: an empty `userId` would attribute a
    // round to a `user` row that cannot exist.
    const payload = Buffer.from(
      JSON.stringify({ ...TICKET, userId: '', exp: NOW + 1000 }),
      'utf8',
    ).toString('base64url');
    const value = mintTicket(SECRET, { ...TICKET, userId: 'x' }, NOW);
    const [, signature] = value.split('.') as [string, string];

    expect(readTicket(SECRET, `${payload}.${signature}`, AT, NOW)).toBeNull();
  });
});
