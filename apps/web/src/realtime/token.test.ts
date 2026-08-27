/** @vitest-environment jsdom */

// D5 — the client owns the token.
//
// The shape matters: `apps/realtime` accepts 16 to 128 of `[A-Za-z0-9_-]` and
// drops anything else, and a token silently dropped is a seat silently lost.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sessionToken } from './token.js';

beforeEach(() => {
  globalThis.sessionStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('7.1 — the session token', () => {
  it('is the shape the server accepts', () => {
    expect(sessionToken()).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
  });

  // "For as long as the tab lives" is the whole guarantee: a token that changed
  // between two connections is a player who cannot come back.
  it('is the same one every time it is asked', () => {
    const first = sessionToken();
    expect(sessionToken()).toBe(first);
    expect(sessionToken()).toBe(first);
  });

  it('mints a new one for a tab that has none', () => {
    const first = sessionToken();
    globalThis.sessionStorage.clear();
    expect(sessionToken()).not.toBe(first);
  });

  // A private window with storage disabled. Playing without a token is what step
  // 5.5 chose: the player gets in and cannot reclaim their nickname afterwards.
  // Refusing to play would be worse.
  it('answers empty rather than throwing when there is nowhere to keep it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage is disabled');
    });
    expect(sessionToken()).toBe('');
  });
});
