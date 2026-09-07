// Where the socket points, and what it carries.
//
// Two of these are bugs the current client has. It builds the URL from
// `window.location.host`, which only works because a dev proxy forwards `/ws` to
// the backend — the rewrite deploys the two separately. And it interpolates the
// raw nickname into the path, so a name with a space either fails to connect or
// arrives mangled: bug 2.1.10, and the server's own schema allows the space.
//
// **This suite used to pass by accident, and it is worth saying how.**
// `endpoint.ts` reads `NEXT_PUBLIC_REALTIME_URL` into a module constant, and
// every assertion below about "the page's own host" is really an assertion that
// the constant is empty. Nothing here said so: the variable happened to be
// absent because the suites never loaded `.env.local`. The moment they did —
// which is the point of the change this file sits in — all seven went red
// against a developer's own socket URL, and read like a defect in a function
// nobody had touched.
//
// So the precondition is stated now, per case, and the configured branch gets
// the coverage it never had. That branch is the one production runs: the app is
// on Vercel and the socket service is not, so `CONFIGURED` is never empty
// anywhere a player plays.
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * `socketUrl`, with the deployment variable set to exactly this.
 *
 * `resetModules` and a dynamic import because `endpoint.ts` reads the variable
 * once, at module scope — deliberately, since Next inlines the literal at build
 * time and a browser has no `process.env` to consult later. A test that stubbed
 * the environment after importing would stub nothing.
 *
 * `undefined` means *unset*, which is what a deployment serving both from one
 * host looks like.
 */
async function endpoint(configured: string | undefined) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_REALTIME_URL', configured);
  const { socketUrl } = await import('./endpoint.js');
  return socketUrl;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('7.1 — the socket URL, with nothing configured', () => {
  it('follows the page', async () => {
    const socketUrl = await endpoint(undefined);

    expect(socketUrl('http://localhost:3000', 'A1B2C3', 'ada', '')).toBe(
      'ws://localhost:3000/ws/A1B2C3/ada',
    );
  });

  // An empty value and an absent one mean the same thing, and the `?? ''` in
  // `endpoint.ts` is what makes them: a deployment that sets the variable to
  // nothing gets the page's host rather than a `new URL('')` that throws.
  it('treats an empty value as absent', async () => {
    const socketUrl = await endpoint('');

    expect(socketUrl('http://localhost:3000', 'A1B2C3', 'ada', '')).toBe(
      'ws://localhost:3000/ws/A1B2C3/ada',
    );
  });

  // A page served over https must not open an insecure socket: a browser blocks
  // it outright, and the failure is a game that never connects in production and
  // always connects in development.
  it('upgrades with the page', async () => {
    const socketUrl = await endpoint(undefined);

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
  ])('encodes %s', async (name, encoded) => {
    const socketUrl = await endpoint(undefined);

    expect(socketUrl('http://localhost:3000', 'A1B2C3', name, '')).toBe(
      `ws://localhost:3000/ws/A1B2C3/${encoded}`,
    );
  });

  it('carries the token as a query parameter, and omits it when there is none', async () => {
    const socketUrl = await endpoint(undefined);

    expect(socketUrl('http://x.example', 'A1B2C3', 'ada', 'abc-123')).toBe(
      'ws://x.example/ws/A1B2C3/ada?token=abc-123',
    );
    expect(socketUrl('http://x.example', 'A1B2C3', 'ada', '')).not.toContain('token');
  });
});

describe('7.1 — the socket URL, with a deployment that configures one', () => {
  // The branch every player is on. The app is served from one origin and the
  // socket service from another, which is the whole reason the variable exists
  // — and until this change nothing exercised it.
  it('goes to the configured host and not to the page', async () => {
    const socketUrl = await endpoint('wss://realtime.wikifake.example');

    expect(socketUrl('https://wikifake.example', 'A1B2C3', 'ada', '')).toBe(
      'wss://realtime.wikifake.example/ws/A1B2C3/ada',
    );
  });

  it('upgrades a configured http URL, and leaves ws alone', async () => {
    // A deployment that writes `https://` gets `wss://`, because the variable
    // names a *host* and the scheme it is reached over is the same decision the
    // page's own is. `ws://localhost` in development stays insecure, which is
    // what a developer means by it.
    const secure = await endpoint('https://realtime.wikifake.example');
    expect(secure('http://x.example', 'A1B2C3', 'ada', '')).toContain(
      'wss://realtime.wikifake.example/',
    );

    const local = await endpoint('ws://localhost:4101');
    expect(local('http://localhost:3000', 'A1B2C3', 'ada', '')).toBe(
      'ws://localhost:4101/ws/A1B2C3/ada',
    );
  });

  it('still encodes the name and still carries the token', async () => {
    // The two bugs 7.1 fixed are properties of the path, not of the host, and a
    // configured deployment must not lose either of them.
    const socketUrl = await endpoint('wss://realtime.wikifake.example');

    expect(socketUrl('https://wikifake.example', 'A1B2C3', 'Jean Dupont', 'abc-123')).toBe(
      'wss://realtime.wikifake.example/ws/A1B2C3/Jean%20Dupont?token=abc-123',
    );
  });

  it('ignores a path the variable happens to carry', async () => {
    // `new URL(base)` then `url.pathname = …`: a variable set to
    // `wss://host/ws` would otherwise produce `/ws/ws/A1B2C3/ada`. Worth
    // pinning, because writing the path into the variable is the obvious
    // mistake to make when configuring it.
    const socketUrl = await endpoint('wss://realtime.wikifake.example/ws');

    expect(socketUrl('https://wikifake.example', 'A1B2C3', 'ada', '')).toBe(
      'wss://realtime.wikifake.example/ws/A1B2C3/ada',
    );
  });
});
