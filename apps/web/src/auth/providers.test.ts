import { describe, expect, it } from 'vitest';

import { callbackUrl, socialProviders } from './providers.js';
import type { Env } from '@wikifake/env';

/** Only the fields `socialProviders` reads; the rest of `Env` is irrelevant here. */
const env = (overrides: Partial<Env>): Env => ({ ...overrides }) as Env;

describe('the providers this deployment offers', () => {
  // The point of the step's design: the game has to be developable with nobody's
  // OAuth console open.
  it('offers none when none is configured', () => {
    expect(socialProviders(env({}))).toEqual({});
  });

  it('offers the ones whose credentials are both present', () => {
    // Values kept short and obviously not credentials: the repository's secret
    // scanner refuses anything that reads like one, and rightly.
    expect(
      socialProviders(
        env({ GOOGLE_OAUTH_CLIENT_ID: 'g-id', GOOGLE_OAUTH_CLIENT_SECRET: 'g-sec' }),
      ),
    ).toEqual({ google: { clientId: 'g-id', clientSecret: 'g-sec' } });
  });

  it('offers both when both are configured', () => {
    const configured = socialProviders(
      env({
        GOOGLE_OAUTH_CLIENT_ID: 'g-id',
        GOOGLE_OAUTH_CLIENT_SECRET: 'g-sec',
        GITHUB_OAUTH_CLIENT_ID: 'h-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'h-sec',
      }),
    );

    expect(Object.keys(configured).sort()).toEqual(['github', 'google']);
  });

  // Half a pair is somebody's intention, half-typed. Offering nothing silently
  // would leave them staring at a missing sign-in button with no explanation.
  it('refuses half a pair, and names the missing half', () => {
    expect(() => socialProviders(env({ GOOGLE_OAUTH_CLIENT_ID: 'g-id' }))).toThrow(
      /GOOGLE_OAUTH_CLIENT_SECRET/,
    );
    expect(() => socialProviders(env({ GITHUB_OAUTH_CLIENT_SECRET: 'h-sec' }))).toThrow(
      /GITHUB_OAUTH_CLIENT_ID/,
    );
  });
});

describe('the redirect URI a provider console needs', () => {
  it('hangs off the configured base URL', () => {
    expect(callbackUrl('https://wikifake.example', 'google')).toBe(
      'https://wikifake.example/api/auth/callback/google',
    );
    expect(callbackUrl('http://localhost:3000', 'github')).toBe(
      'http://localhost:3000/api/auth/callback/github',
    );
  });

  it('does not double a trailing slash', () => {
    expect(callbackUrl('https://wikifake.example/', 'google')).toBe(
      'https://wikifake.example/api/auth/callback/google',
    );
  });
});
