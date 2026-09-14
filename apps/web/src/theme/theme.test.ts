// The choice, and the two things about it that are not decoration — step L.9.
//
// `themeFrom` is the gate every value passes: a cookie is something anybody can
// write, and the only safe answer to one nobody recognises is the default.
//
// `safeReturn` is the one with teeth. The switch is a form, a form is something
// anybody can post, and a redirect that trusted its own `next` field would
// forward a visitor anywhere on the web with this site's domain in front of it.
import { describe, expect, it } from 'vitest';

import { classFor, DEFAULT_THEME, safeReturn, themeFrom, THEMES } from './choice.js';
import { handleChooseTheme } from './handler.js';

/** A form post, the way the switch makes one. */
function chosen(fields: Record<string, string>): Request {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) body.append(name, value);
  return new Request('https://wikifake.test/api/theme', { method: 'POST', body });
}

describe('L.9 — what a cookie is allowed to say', () => {
  it.each(THEMES)('keeps %s, which is one of the three', (theme) => {
    expect(themeFrom(theme)).toBe(theme);
  });

  it.each([undefined, '', 'DARK', 'midnight', 'light dark', '../etc'])(
    'answers the default for %s',
    (value) => {
      expect(themeFrom(value)).toBe(DEFAULT_THEME);
    },
  );

  /*
   * `system` is the absence of a class, not a class of its own.
   *
   * The stylesheet has no `.system`, and it must not: *system* is what the
   * media query answers, and a third class would be a third palette somebody
   * has to write and measure.
   */
  it('gives system no class, so the media query can answer', () => {
    expect(classFor('system')).toBeNull();
    expect(classFor('light')).toBe('light');
    expect(classFor('dark')).toBe('dark');
  });
});

describe('L.9 — where a reader is sent back to', () => {
  it.each(['/', '/fr/play', '/en/admin/cost?range=month'])('allows %s', (path) => {
    expect(safeReturn(path)).toBe(path);
  });

  /*
   * The protocol-relative one is the case worth naming: `//evil.test/x` is an
   * absolute URL that passes every check written as "does it start with a
   * slash", which is how this defect is usually shipped.
   */
  it.each([
    null,
    '//evil.test/phish',
    'https://evil.test',
    'javascript:alert(1)',
    'play',
  ])('refuses %s and falls back', (asked) => {
    expect(safeReturn(asked)).toBe('/');
  });
});

describe('L.9 — the route', () => {
  it('sets the cookie and sends the reader back where they were', async () => {
    const answer = await handleChooseTheme(chosen({ theme: 'dark', next: '/fr/play' }));

    // 303: the answer to a post is a page to get. A 302 leaves the method to
    // the client, and a browser repeating the post would re-choose on a back.
    expect(answer.status).toBe(303);
    expect(answer.headers.get('location')).toBe('/fr/play');

    const cookie = answer.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('THEME=dark');
    expect(cookie).toContain('path=/');
    expect(cookie).toContain('samesite=lax');
  });

  it('writes the default rather than refusing a value it does not know', async () => {
    const answer = await handleChooseTheme(chosen({ theme: 'neon', next: '/' }));

    expect(answer.status).toBe(303);
    expect(answer.headers.get('set-cookie')).toContain('THEME=system');
  });

  it('does not forward to another site, whatever the form carried', async () => {
    const answer = await handleChooseTheme(
      chosen({ theme: 'light', next: '//evil.test/phish' }),
    );

    expect(answer.headers.get('location')).toBe('/');
  });

  it('answers a post with no form at all', async () => {
    // A bare POST is a thing that happens: a crawler, a retry, a hand-written
    // curl. It gets the default and the front page rather than a 500.
    const answer = await handleChooseTheme(
      new Request('https://wikifake.test/api/theme', { method: 'POST' }),
    );

    expect(answer.status).toBe(303);
    expect(answer.headers.get('location')).toBe('/');
    expect(answer.headers.get('set-cookie')).toContain('THEME=system');
  });
});
