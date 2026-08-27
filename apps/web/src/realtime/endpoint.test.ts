// Where the socket points, and what it carries.
//
// Two of these are bugs the current client has. It builds the URL from
// `window.location.host`, which only works because a dev proxy forwards `/ws` to
// the backend — the rewrite deploys the two separately. And it interpolates the
// raw nickname into the path, so a name with a space either fails to connect or
// arrives mangled: bug 2.1.10, and the server's own schema allows the space.
import { describe, expect, it } from 'vitest';

import { socketUrl } from './endpoint.js';

describe('7.1 — the socket URL', () => {
  it('follows the page when nothing is configured', () => {
    expect(socketUrl('http://localhost:3000', 'A1B2C3', 'ada', '')).toBe(
      'ws://localhost:3000/ws/A1B2C3/ada',
    );
  });

  // A page served over https must not open an insecure socket: a browser blocks
  // it outright, and the failure is a game that never connects in production and
  // always connects in development.
  it('upgrades with the page', () => {
    expect(socketUrl('https://wikifake.example', 'A1B2C3', 'ada', '')).toBe(
      'wss://wikifake.example/ws/A1B2C3/ada',
    );
  });

  // Bug 2.1.10.
  it.each([
    ['Jean Dupont', 'Jean%20Dupont'],
    ['Élise', '%C3%89lise'],
    ['a/b', 'a%2Fb'],
    ['a?b', 'a%3Fb'],
  ])('encodes %s', (name, encoded) => {
    expect(socketUrl('http://localhost:3000', 'A1B2C3', name, '')).toBe(
      `ws://localhost:3000/ws/A1B2C3/${encoded}`,
    );
  });

  it('carries the token as a query parameter, and omits it when there is none', () => {
    expect(socketUrl('http://x.example', 'A1B2C3', 'ada', 'abc-123')).toBe(
      'ws://x.example/ws/A1B2C3/ada?token=abc-123',
    );
    expect(socketUrl('http://x.example', 'A1B2C3', 'ada', '')).not.toContain('token');
  });
});
