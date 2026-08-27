// Which origins may open a socket, decided rather than discovered.
//
// The server test proves the policy is applied; this proves the policy is right.
// The two failure modes are opposite and both bad: refusing the app over a
// trailing slash — which whoever hits it "fixes" by widening the list — and
// accepting everything because the list was left empty.
import { describe, expect, it } from 'vitest';

import { createOriginPolicy, parseOrigins } from './origins.js';

const APP = 'https://wikifake.example';

describe('parsing the configured list', () => {
  it('splits on commas and trims', () => {
    expect(parseOrigins(` ${APP} , https://preview.example `)).toEqual([
      APP,
      'https://preview.example',
    ]);
  });

  it('drops empties rather than turning them into an origin', () => {
    expect(parseOrigins(`${APP},,`)).toEqual([APP]);
    expect(parseOrigins('  ')).toEqual([]);
  });
});

describe('deciding on an origin', () => {
  const policy = createOriginPolicy([APP]);

  it('accepts the configured origin', () => {
    expect(policy.accepts(APP)).toBe(true);
  });

  // The same origin, spelled two ways. A string comparison refuses one of them,
  // and the "fix" for that is always to widen the list.
  it('compares origins as origins, not as strings', () => {
    expect(policy.accepts(`${APP}/`)).toBe(true);
    expect(policy.accepts(`${APP}/some/path`)).toBe(true);
    expect(policy.accepts(`${APP}:443`)).toBe(true);
  });

  it('refuses a different host, scheme or port', () => {
    expect(policy.accepts('https://elsewhere.example')).toBe(false);
    expect(policy.accepts('http://wikifake.example')).toBe(false);
    expect(policy.accepts('https://wikifake.example:8443')).toBe(false);
    // A near miss that a `startsWith` or a suffix check would let through.
    expect(policy.accepts('https://wikifake.example.attacker.test')).toBe(false);
  });

  it('refuses something that is not an origin at all', () => {
    expect(policy.accepts('null')).toBe(false);
    expect(policy.accepts('not an origin')).toBe(false);
  });

  // Browsers always send an `Origin` on a WebSocket handshake, so its absence
  // cannot be used to bypass the list: what has none is a probe, a protocol
  // test, or a native client.
  it('accepts a handshake with no origin header', () => {
    expect(policy.accepts(undefined)).toBe(true);
    expect(policy.accepts('')).toBe(true);
  });

  // Fails closed. A misconfiguration that accepts everything is one nobody
  // notices until it is being used.
  it('refuses every browser when nothing is configured', () => {
    const empty = createOriginPolicy([]);

    expect(empty.accepts(APP)).toBe(false);
    expect(empty.allowed).toEqual([]);
    // Still open to what is not a browser, so a health probe survives a
    // misconfiguration and the platform can still say the service is up.
    expect(empty.accepts(undefined)).toBe(true);
  });

  it('ignores a configured entry that is not an origin', () => {
    const policy = createOriginPolicy(['nonsense', APP]);
    expect(policy.allowed).toEqual([APP]);
  });
});
