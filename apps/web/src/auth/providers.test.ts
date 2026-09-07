import { describe, expect, it } from 'vitest';

import { assertCallbackReachable, callbackUrl, socialProviders } from './providers.js';
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

describe('E.1 — a deployment that offers OAuth from an address nobody can reach', () => {
  const google = {
    GOOGLE_OAUTH_CLIENT_ID: 'g-id',
    GOOGLE_OAUTH_CLIENT_SECRET: 'g-sec',
  };

  /*
   * The failure this exists for.
   *
   * `BETTER_AUTH_URL` defaults to `http://localhost:3000`. A deployment that
   * never set it sends every player who signs in to their own machine, and
   * nothing anywhere says so — the browser simply lands on nothing. The same
   * default decides `REALTIME_ALLOWED_ORIGINS`' fallback and the canonical URL,
   * so it is one variable with three silent consequences.
   */
  it.each(['http://localhost:3000', 'http://127.0.0.1:3000', 'http://0.0.0.0:3000'])(
    'refuses %s on a platform',
    (url) => {
      expect(() =>
        assertCallbackReachable(env({ ...google, BETTER_AUTH_URL: url }), {
          VERCEL: '1',
        }),
      ).toThrow(/BETTER_AUTH_URL/);
    },
  );

  it('names the redirect URI the console still needs', () => {
    // The next thing whoever reads this has to do is paste a string into
    // Google's console, so the message carries it.
    expect(() =>
      assertCallbackReachable(
        env({ ...google, BETTER_AUTH_URL: 'http://localhost:3000' }),
        {
          RENDER: 'true',
        },
      ),
    ).toThrow(/google.*http:\/\/localhost:3000\/api\/auth\/callback\/google/s);
  });

  it('accepts a real public URL', () => {
    expect(() =>
      assertCallbackReachable(
        env({ ...google, BETTER_AUTH_URL: 'https://wikifake.example' }),
        { VERCEL: '1' },
      ),
    ).not.toThrow();
  });

  /*
   * The two ways it must stay quiet, and they are the point of checking here
   * rather than in the environment schema.
   *
   * A developer runs on localhost with a provider configured against their own
   * machine, which is how the flow is tested at all. And a deployment with no
   * provider has no redirect URI to get wrong — refusing to start it would be
   * refusing a game that works, since the whole design of this file is that
   * OAuth is optional.
   */
  it('says nothing on a developer machine', () => {
    expect(() =>
      assertCallbackReachable(
        env({ ...google, BETTER_AUTH_URL: 'http://localhost:3000' }),
        {
          NODE_ENV: 'development',
        },
      ),
    ).not.toThrow();
  });

  it('says nothing when no provider is configured', () => {
    expect(() =>
      assertCallbackReachable(env({ BETTER_AUTH_URL: 'http://localhost:3000' }), {
        VERCEL: '1',
      }),
    ).not.toThrow();
  });

  // `NODE_ENV=production` alone is a production *build*, which a laptop runs
  // too — so it counts, but the platform variables are what it is really about.
  it('counts a production build as deployed', () => {
    expect(() =>
      assertCallbackReachable(
        env({ ...google, BETTER_AUTH_URL: 'http://localhost:3000' }),
        {
          NODE_ENV: 'production',
        },
      ),
    ).toThrow(/BETTER_AUTH_URL/);
  });
});
